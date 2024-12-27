import { ValidationConfig, createConfig, relaxedConfig } from "../src/types";
import { ResourceManager } from "../src/resource-manager";
import { parse } from "@babel/parser";
import { CallExpression } from "@babel/types";

/**
 * Creates a mock resource manager for testing
 * Allows controlling timeouts, node counts etc.
 */
export class TestResourceManager extends ResourceManager {
  private mockNodeCount = 0;
  private mockTimeoutTriggered = false;

  constructor(config: ValidationConfig) {
    super(config);
  }

  public setMockNodeCount(count: number) {
    this.mockNodeCount = count;
  }

  public triggerTimeout() {
    this.mockTimeoutTriggered = true;
  }

  public override incrementNodeCount(): void {
    if (this.mockTimeoutTriggered) {
      throw new Error("Timeout triggered");
    }
    if (this.mockNodeCount >= this.config.maxNodeCount) {
      throw new Error("Node count exceeded");
    }
    this.mockNodeCount++;
  }
}

/**
 * Helper to parse code into a CallExpression AST node
 */
export function parseCallExpression(code: string): CallExpression {
  const ast = parse(code);
  const stmt = ast.program.body[0];
  if (stmt.type !== "ExpressionStatement") {
    throw new Error("Expected expression statement");
  }
  const expr = stmt.expression;
  if (expr.type !== "CallExpression") {
    throw new Error("Expected call expression");
  }
  return expr;
}

/**
 * Creates a test configuration with specific overrides
 */
export function createTestConfig(
  overrides?: Partial<ValidationConfig>
): ValidationConfig {
  return createConfig(relaxedConfig, {
    timeoutMs: 1000,
    maxNodeCount: 100,
    allowComputedProperties: false, // Explicitly disable computed properties for tests
    schemaUnification: { enabled: true },
    ...overrides,
  });
}

/**
 * Helper to create schema validation inputs
 */
export function createSchemaInput(schema: string): string {
  // Ensure proper formatting and no extra whitespace
  return `import { z } from 'zod';\nexport const testSchema = ${schema};`;
}

/**
 * Verifies that validation produces expected issues
 */
export function expectValidationIssues(
  issues: Array<{ message: string; nodeType: string }>,
  expectedIssues: Array<Partial<{ message: string; nodeType: string }>>
) {
  // Check that all expected issues are present, in any order
  expectedIssues.forEach((expected) => {
    const matchingIssue = issues.find((issue) => {
      if (expected.message && !issue.message.includes(expected.message)) {
        return false;
      }
      if (expected.nodeType && issue.nodeType !== expected.nodeType) {
        return false;
      }
      return true;
    });

    if (!matchingIssue) {
      throw new Error(
        `Expected to find issue matching ${JSON.stringify(expected)}\n` +
          `Actual issues: ${JSON.stringify(issues, null, 2)}`
      );
    }
  });
}

/**
 * Common test schemas
 */
export const testSchemas = {
  basic: `z.object({ name: z.string() })`,
  unsafe: `z.object({ constructor: z.function() })`,
  complex: `
    z.object({
      id: z.string().uuid(),
      data: z.record(z.string(), z.any()),
      meta: z.object({
        created: z.date(),
        tags: z.array(z.string())
      })
    })
  `,
};
