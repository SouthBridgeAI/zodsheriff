import { ArgumentValidator } from "../src/argument-validator";
import {
  TestResourceManager,
  createTestConfig,
  parseCallExpression,
} from "./test-utils";
import { parse } from "@babel/parser";
import { CallExpression } from "@babel/types";

describe("ArgumentValidator", () => {
  let validator: ArgumentValidator;
  let resourceManager: TestResourceManager;

  beforeEach(() => {
    const config = createTestConfig();
    resourceManager = new TestResourceManager(config);
    validator = new ArgumentValidator(config, resourceManager);
  });

  function parseAndValidate(code: string, methodName: string): boolean {
    const ast = parse(code);
    const stmt = ast.program.body[0];
    if (stmt.type !== "ExpressionStatement")
      throw new Error("Expected expression statement");
    const expr = stmt.expression;
    if (expr.type !== "CallExpression")
      throw new Error("Expected call expression");
    return validator.validateMethodArguments(expr, methodName);
  }

  describe("validateMethodArguments", () => {
    it("should validate refine method arguments with a proper function", () => {
      const result = parseAndValidate(
        `schema.refine((val) => val > 0)`,
        "refine"
      );
      expect(result).toBe(true);
    });

    it("should reject refine method arguments if function is async", () => {
      const result = parseAndValidate(
        `schema.refine(async (val) => val > 0)`,
        "refine"
      );
      expect(result).toBe(false);
    });

    it("should reject refine method arguments if function is a generator", () => {
      const result = parseAndValidate(
        `schema.refine(function* (val) { yield val; })`,
        "refine"
      );
      expect(result).toBe(false);
    });

    it("should validate transform method arguments with a simple synchronous function", () => {
      const result = parseAndValidate(
        `schema.transform(val => val.toString())`,
        "transform"
      );
      expect(result).toBe(true);
    });

    it("should validate pipe method arguments if it’s a schema call", () => {
      // Assume pipe allows schema as argument (as per rules)
      const result = parseAndValidate(`schema.pipe(z.string())`, "pipe");
      expect(result).toBe(true);
    });

    it("should reject pipe method arguments if it’s a function (not allowed for pipe)", () => {
      const result = parseAndValidate(`schema.pipe((val) => val)`, "pipe");
      expect(result).toBe(false);
    });

    it("should validate regex method arguments with a safe regex", () => {
      const result = parseAndValidate(`schema.regex(/^[a-z]+$/)`, "regex");
      expect(result).toBe(true);
    });

    it("should reject regex method arguments if pattern is not safe", () => {
      // Example of a catastrophic regex
      const result = parseAndValidate(`schema.regex(/^(a+)+$/)`, "regex");
      expect(result).toBe(false);
    });

    it("should allow a literal argument (e.g., number) for methods with no specific restrictions", () => {
      // For an unknown method with no rules, we just return true
      const callExpr = parseCallExpression(`schema.unknownMethod(42)`);
      const result = validator.validateMethodArguments(
        callExpr,
        "unknownMethod"
      );
      // No rules for unknownMethod, should return true per current logic
      expect(result).toBe(true);
    });

    it("should reject too many arguments for transform (max 1)", () => {
      const result = parseAndValidate(
        `schema.transform(val => val, "extra")`,
        "transform"
      );
      expect(result).toBe(false);
    });

    it("should reject too few arguments for refine (min 1)", () => {
      const result = parseAndValidate(`schema.refine()`, "refine");
      expect(result).toBe(false);
    });
  });
});
