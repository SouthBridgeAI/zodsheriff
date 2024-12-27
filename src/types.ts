import { IssueSeverity } from "./reporting";
import { SchemaGroup } from "./schema-groups";

/**
 * Core configuration interface for validation settings
 */
export interface ValidationConfig {
  // Timeout settings
  timeoutMs: number;

  // Resource limits
  maxNodeCount: number;
  maxObjectDepth: number;
  maxChainDepth: number;
  maxArgumentNesting: number;
  maxPropertiesPerObject: number;
  maxStringLength: number;

  // Performance settings
  enableParallelProcessing: boolean;
  maxConcurrentValidations: number;
  enableCaching: boolean;

  // Safety settings
  allowLoops: boolean;
  allowComputedProperties: boolean;
  allowTemplateExpressions: boolean;
  propertySafety: PropertySafetyConfig;

  // Runtime checks
  addRuntimeProtection: boolean;

  schemaUnification?: SchemaUnificationOptions;
}

export interface SchemaUnificationOptions {
  enabled: boolean;
  /**
   * If true, and if the *very root* of a grouped schema is an array literal,
   * we unwrap it (remove the array) before finalizing.
   */
  unwrapArrayRoot?: boolean;
}

/**
 * Configuration for property name safety checks
 */
export interface PropertySafetyConfig {
  allowedPrefixes: string[];
  deniedPrefixes: string[];
  allowedProperties: Set<string>;
  deniedProperties: Set<string>;
}

/**
 * Predefined validation configurations
 */
export const extremelySafeConfig: ValidationConfig = {
  timeoutMs: 1000,
  maxNodeCount: 1000,
  maxObjectDepth: 3,
  maxChainDepth: 3,
  maxArgumentNesting: 2,
  maxPropertiesPerObject: 20,
  maxStringLength: 100,
  enableParallelProcessing: false,
  maxConcurrentValidations: 1,
  enableCaching: true,
  allowLoops: false,
  allowComputedProperties: false,
  allowTemplateExpressions: false,
  propertySafety: {
    allowedPrefixes: [],
    deniedPrefixes: ["_", "$"],
    allowedProperties: new Set(["type", "value", "items"]),
    deniedProperties: new Set(["__proto__", "constructor", "prototype"]),
  },
  addRuntimeProtection: true,
};

export const mediumConfig: ValidationConfig = {
  timeoutMs: 5000, // 5 seconds
  maxNodeCount: 10000,
  maxObjectDepth: 5,
  maxChainDepth: 5,
  maxArgumentNesting: 4,
  maxPropertiesPerObject: 100,
  maxStringLength: 1000,
  enableParallelProcessing: true,
  maxConcurrentValidations: 4,
  enableCaching: true,
  allowLoops: true,
  allowComputedProperties: false,
  allowTemplateExpressions: true,
  propertySafety: {
    allowedPrefixes: [],
    deniedPrefixes: ["__"], // Only block double underscore
    allowedProperties: new Set(), // Empty = allow all except denied
    deniedProperties: new Set([
      "__proto__",
      "constructor",
      "prototype",
      "eval",
      "arguments",
      "process",
      "global",
      "window",
      "document",
    ]),
  },
  addRuntimeProtection: true,
};

export const relaxedConfig: ValidationConfig = {
  timeoutMs: 30000, // 30 seconds
  maxNodeCount: 1000000,
  maxObjectDepth: 10,
  maxChainDepth: 10,
  maxArgumentNesting: 8,
  maxPropertiesPerObject: 1000,
  maxStringLength: 10000,
  enableParallelProcessing: true,
  maxConcurrentValidations: 8,
  enableCaching: true,
  allowLoops: true,
  allowComputedProperties: true,
  allowTemplateExpressions: true,
  propertySafety: {
    allowedPrefixes: [], // Allow all prefixes
    deniedPrefixes: ["__"], // Still block double underscore for safety
    allowedProperties: new Set(), // Empty = allow all except denied
    deniedProperties: new Set([
      "__proto__",
      "constructor", // Minimal safety - just block prototype pollution
    ]),
  },
  addRuntimeProtection: false, // Trust the code more in relaxed mode
  schemaUnification: {
    enabled: true,
    unwrapArrayRoot: true,
  },
};

// Helper to combine configs with overrides
export function createConfig(
  baseConfig: ValidationConfig,
  overrides?: Partial<ValidationConfig>
): ValidationConfig {
  return {
    ...baseConfig,
    ...overrides,
    // Deep merge for nested objects
    propertySafety: {
      ...baseConfig.propertySafety,
      ...overrides?.propertySafety,
      // Ensure Sets are properly merged
      allowedProperties: new Set([
        ...Array.from(baseConfig.propertySafety.allowedProperties),
        ...(overrides?.propertySafety?.allowedProperties || []),
      ]),
      deniedProperties: new Set([
        ...Array.from(baseConfig.propertySafety.deniedProperties),
        ...(overrides?.propertySafety?.deniedProperties || []),
      ]),
    },
  };
}

/**
 * Location information for nodes
 */
export interface Location {
  line: number;
  column: number;
}

/**
 * Base interface for all validation context
 */
export interface ValidationContext {
  config: ValidationConfig;
  parentNodes: Node[];
  depth: number;
}

/**
 * Result of schema validation
 */
export interface ValidationResult {
  /** Whether the schema is valid (no errors found) */
  isValid: boolean;
  /** The cleaned and formatted schema code */
  cleanedCode: string;
  /** Array of validation issues found */
  issues: Array<{
    line: number;
    column?: number;
    message: string;
    nodeType: string;
    severity: IssueSeverity;
    suggestion?: string;
  }>;
  /** Names of recognized root-level schemas */
  rootSchemaNames: string[];
  /** Independent schema groups, if grouping was requested */
  schemaGroups?: SchemaGroup[];
}
