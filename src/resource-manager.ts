import type { Node } from "@babel/types";
import { type ValidationConfig, relaxedConfig } from "./types";
/**
 * Manages resource usage and enforces limits during validation
 * Tracks node count, execution time, and validates against configured limits
 */
export class ResourceManager {
  private nodeCount = 0;
  private startTime: number;
  readonly config: ValidationConfig;
  private lastTimeoutCheck: number = Date.now();
  private readonly CHECK_INTERVAL_MS = 100; // Check every 100ms

  // Track resource usage per validation level to handle nested validations
  private readonly depthMap: Map<number, number> = new Map();

  constructor(config: ValidationConfig) {
    this.config = config;
    this.startTime = Date.now();
  }

  /**
   * Resets all counters and timers
   * Should be called before starting a new validation
   */
  public reset(): void {
    this.nodeCount = 0;
    this.startTime = Date.now();
    this.depthMap.clear();
  }

  /**
   * Checks if execution has exceeded configured timeout
   * @throws {ValidationError} if timeout is exceeded
   */
  public checkTimeout(): void {
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.config.timeoutMs) {
      throw new ValidationError(
        `Validation timeout exceeded (${this.config.timeoutMs}ms)`,
        "Timeout",
      );
    }
  }

  /**
   * Checks if execution has exceeded configured timeout
   * @throws {ValidationError} if timeout is exceeded
   */
  public checkTimeoutAggressive(): void {
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.config.timeoutMs * 0.9) {
      // 90% of timeout
      throw new ValidationError(
        `Operation approaching timeout limit`,
        "Timeout",
      );
    }
  }

  /**
   * Runs an async operation with timeout check
   * @param operation - Operation to run
   * @returns Result of operation
   */
  public async withTimeoutCheck<T>(operation: () => Promise<T>): Promise<T> {
    this.checkTimeoutAggressive();
    const result = await operation();
    this.checkTimeout();
    return result;
  }

  /**
   * Runs a synchronous operation with timeout check
   * Uses Node.js worker threads for CPU-bound operations
   * @param operation - Operation to run
   * @returns Result of operation
   * @throws {ValidationError} if timeout is exceeded
   **/
  public withTimeoutCheckSync<T>(operation: () => T): T {
    this.checkTimeoutAggressive();
    const result = operation();
    this.checkTimeout();
    return result;
  }

  /**
   * Increments node count and checks against limit
   * @throws {ValidationError} if node count exceeds maximum
   */
  public incrementNodeCount(): void {
    this.nodeCount++;

    // Only check timeout periodically
    const now = Date.now();
    if (now - this.lastTimeoutCheck > this.CHECK_INTERVAL_MS) {
      this.checkTimeout();
      this.lastTimeoutCheck = now;
    }

    if (this.nodeCount > this.config.maxNodeCount) {
      throw new ValidationError(
        `Node count exceeded maximum of ${this.config.maxNodeCount}`,
        "NodeLimit",
      );
    }
  }

  /**
   * Tracks and validates nested depth of validations
   * @param depth - Current depth level
   * @param type - Type of depth being tracked (e.g., 'object', 'chain')
   * @throws {ValidationError} if depth exceeds maximum
   */
  public trackDepth(
    depth: number,
    type: "object" | "chain" | "argument",
  ): void {
    const currentCount = this.depthMap.get(depth) || 0;
    this.depthMap.set(depth, currentCount + 1);

    const maxDepth = this.getMaxDepthForType(type);
    if (depth > maxDepth) {
      throw new ValidationError(
        `${type} nesting depth exceeded maximum of ${maxDepth}`,
        "DepthLimit",
      );
    }
  }

  /**
   * Validates size of a collection (array, object properties, etc.)
   * @param size - Size to validate
   * @param maxSize - Maximum allowed size
   * @param type - Type of collection being validated
   * @throws {ValidationError} if size exceeds maximum
   */
  public validateSize(size: number, maxSize: number, type: string): void {
    if (size > maxSize) {
      throw new ValidationError(
        `${type} size exceeded maximum of ${maxSize}`,
        "SizeLimit",
      );
    }
  }

  /**
   * Returns current resource usage statistics
   */
  public getStats(): ResourceStats {
    return {
      nodeCount: this.nodeCount,
      executionTime: Date.now() - this.startTime,
      maxDepthReached: Math.max(...this.depthMap.keys(), 0),
    };
  }

  private getMaxDepthForType(type: "object" | "chain" | "argument"): number {
    switch (type) {
      case "object":
        return this.config.maxObjectDepth;
      case "chain":
        return this.config.maxChainDepth;
      case "argument":
        return this.config.maxArgumentNesting;
      default:
        throw new Error(`Unknown depth type: ${type}`);
    }
  }
}

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly type: ValidationErrorType,
    public readonly node?: Node,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Types of validation errors that can occur
 */
export type ValidationErrorType =
  | "Timeout"
  | "NodeLimit"
  | "DepthLimit"
  | "SizeLimit";

/**
 * Statistics about resource usage during validation
 */
export interface ResourceStats {
  nodeCount: number;
  executionTime: number;
  maxDepthReached: number;
}

/**
 * Utility class for running operations with timeout
 */
export class TimeoutRunner {
  constructor(private readonly timeoutMs: number) {}

  /**
   * Runs an async operation with timeout
   * @param operation - Operation to run
   * @returns Result of operation
   * @throws {ValidationError} if timeout is exceeded
   */
  public async runWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new ValidationError(
            `Operation timed out after ${this.timeoutMs}ms`,
            "Timeout",
          ),
        );
      }, this.timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Runs a synchronous operation with timeout
   * Uses Node.js worker threads for CPU-bound operations
   */
  public runSync<T>(operation: () => T): T {
    // TODO: Implementation should use Worker threads
    throw new Error("Not implemented");
  }
}

/**
 * Factory function to create a ResourceManager with optional initial config
 */
export function createResourceManager(
  config?: Partial<ValidationConfig>,
): ResourceManager {
  return new ResourceManager({
    ...relaxedConfig,
    ...config,
  });
}
