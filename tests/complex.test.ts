import { parse } from "@babel/parser";
import { ExpressionStatement, Node } from "@babel/types";
import { SchemaValidator } from "../src/schema-validator";
import { validateObjectExpression } from "../src/object-validator";
import { ChainValidator } from "../src/chain-validator";
import { ArgumentValidator } from "../src/argument-validator";
import { IssueReporter } from "../src/reporting";
import { createTestConfig, TestResourceManager } from "./test-utils";

function parseExpression(code: string): Node {
  const ast = parse(code, { sourceType: "module", plugins: ["typescript"] });
  const stmt = ast.program.body[0] as ExpressionStatement;
  if (!stmt || stmt.type !== "ExpressionStatement") {
    throw new Error("Expected an expression statement");
  }
  return stmt.expression;
}

describe("Complex Validation Tests", () => {
  let config: ReturnType<typeof createTestConfig>;
  let resourceManager: TestResourceManager;
  let issueReporter: IssueReporter;
  let chainValidator: ChainValidator;
  let argumentValidator: ArgumentValidator;
  let schemaValidator: SchemaValidator;

  beforeEach(() => {
    config = createTestConfig();
    resourceManager = new TestResourceManager(config);
    issueReporter = new IssueReporter();
    argumentValidator = new ArgumentValidator(
      config,
      resourceManager,
      issueReporter
    );
    chainValidator = new ChainValidator(
      config,
      resourceManager,
      issueReporter,
      argumentValidator
    );
    schemaValidator = new SchemaValidator(
      config,
      resourceManager,
      issueReporter
    );
  });

  function parseAndValidate(code: string, methodName: string): boolean {
    const ast = parse(code);
    const stmt = ast.program.body[0];
    if (stmt.type !== "ExpressionStatement")
      throw new Error("Expected expression statement");
    const expr = stmt.expression;
    if (expr.type !== "CallExpression")
      throw new Error("Expected call expression");
    return argumentValidator.validateMethodArguments(expr, methodName);
  }

  // -----------------------
  // Argument Validation Tests
  // -----------------------
  describe("ArgumentValidator - complex scenarios", () => {
    it("should validate refine with two arguments and a complex function body", () => {
      const code = `
        schema.refine(
          function(val) {
            const result = val > 0;
            return result;
          },
          { message: "Value must be positive" }
        );
      `;
      const result = parseAndValidate(code, "refine");
      expect(result).toBe(true);
    });

    it("should validate a transform function with nested internal calls", () => {
      const code = `
        schema.transform((val) => {
          function helper(x) { return x.toString().toUpperCase(); }
          return helper(val);
        })
      `;
      const result = parseAndValidate(code, "transform");
      expect(result).toBe(true);
    });

    it("should reject a complex unsafe regex with flags", () => {
      const code = `schema.regex(/^(a+)+$/mi)`;
      const result = parseAndValidate(code, "regex");
      expect(result).toBe(false);
    });

    it("should fail if refine is given a non-function (object) argument", () => {
      const code = `
        schema.refine({
          notAFunction: true
        });
      `;
      // 'refine' expects a function, not an object.
      const result = parseAndValidate(code, "refine");
      expect(result).toBe(false);
    });
  });

  // -----------------------
  // Chain Validation Tests
  // -----------------------
  describe("ChainValidator - complex scenarios", () => {
    it("should detect a disallowed method at the end of a long allowed chain", () => {
      const node = parseExpression(
        `z.string().min(1).max(10).someForbiddenMethod()`
      );
      const result = chainValidator.validateChain(node);
      expect(result).toBe(false);
      const issues = issueReporter.getIssues();
      expect(issues[0].message).toContain("Method not allowed in chain");
    });

    it("should reject complex member expressions with computed properties deep in chain", () => {
      const node = parseExpression(`z.object()[dynamicProp].shape()`);
      const result = chainValidator.validateChain(node);
      expect(result).toBe(false);
      expect(issueReporter.getIssues()[0].message).toContain(
        "Computed properties not allowed in chain"
      );
    });

    it("should fail if chain depth exceeded with multiple valid methods", () => {
      const shallowConfig = createTestConfig({ maxChainDepth: 2 });
      const shallowResourceManager = new TestResourceManager(shallowConfig);
      const shallowIssueReporter = new IssueReporter();
      const shallowArgumentValidator = new ArgumentValidator(
        shallowConfig,
        shallowResourceManager,
        shallowIssueReporter
      );
      const shallowChainValidator = new ChainValidator(
        shallowConfig,
        shallowResourceManager,
        shallowIssueReporter,
        shallowArgumentValidator
      );
      const node = parseExpression(`z.string().min(1).max(2).trim().email()`);
      const result = shallowChainValidator.validateChain(node);
      expect(result).toBe(false);
      expect(
        shallowIssueReporter
          .getIssues()
          .some((issue) =>
            issue.message.includes("Chain nesting depth exceeded")
          )
      ).toBe(true);
    });
  });

  // -----------------------
  // Object Validation Tests
  // -----------------------
  describe("ObjectValidator - complex scenarios", () => {
    function parseObjectExpression(code: string) {
      const ast = parse(code);
      const stmt = ast.program.body[0] as ExpressionStatement;
      if (!stmt || stmt.type !== "ExpressionStatement") {
        throw new Error("Expected expression statement");
      }
      const expr = stmt.expression;
      if (expr.type !== "ObjectExpression") {
        throw new Error("Expected object expression");
      }
      return expr;
    }

    it("should detect unsafe property at a deeper nesting level", () => {
      const code = `
        ({
          safeProp: 1,
          nested: {
            allowed: 2,
            deeper: {
              constructor: "not allowed here"
            }
          }
        })
      `;
      const objExpr = parseObjectExpression(code);
      const result = validateObjectExpression(objExpr, 0, config);
      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((issue) => issue.message.includes("is not allowed"))
      ).toBe(true);
    });

    it("should reject objects with spread elements", () => {
      const code = `
        ({
          ...spreadData
        })
      `;
      const objExpr = parseObjectExpression(code);
      const result = validateObjectExpression(objExpr, 0, config);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].message).toContain(
        "Spread elements are not allowed"
      );
    });
  });

  // -----------------------
  // Schema Validator Tests
  // -----------------------
  describe("SchemaValidator - complex scenarios", () => {
    it("should handle multiple schema declarations and fail if one is invalid", async () => {
      const code = `
        import { z } from 'zod';
        const validSchema = z.string();
        const invalidSchema = undefined;
        export const anotherSchema = z.number();
      `;
      const result = await schemaValidator.validateSchema(code);
      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((issue) =>
          issue.message.includes("Schema declaration must have an initializer")
        )
      ).toBe(true);
    });

    it("should fail if z is not imported from zod", async () => {
      const code = `
        import { z as differentName } from 'zod';
        export const testSchema = differentName.string();
      `;
      const result = await schemaValidator.validateSchema(code);
      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((issue) =>
          issue.message.includes("Missing 'z' import from 'zod'")
        )
      ).toBe(true);
    });

    it("should fail if something else is imported from another library", async () => {
      const code = `
        import { z } from 'zod';
        import x from 'not-zod';
        const testSchema = z.string();
      `;
      const result = await schemaValidator.validateSchema(code);
      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((issue) =>
          issue.message.includes("Only 'zod' imports are allowed")
        )
      ).toBe(true);
    });
  });
});
