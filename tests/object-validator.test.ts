import { validateObjectExpression } from "../src/object-validator";
import { createTestConfig } from "./test-utils";
import { parse } from "@babel/parser";
import { ObjectExpression, ExpressionStatement } from "@babel/types";
import { IssueSeverity } from "../src/reporting";

describe("ObjectValidator", () => {
  const config = createTestConfig();

  function parseObjectExpression(code: string): ObjectExpression {
    const ast = parse(code);
    const stmt = ast.program.body[0];
    if (!stmt || stmt.type !== "ExpressionStatement") {
      throw new Error("Expected expression statement");
    }
    const expr = (stmt as ExpressionStatement).expression;
    if (expr.type !== "ObjectExpression") {
      throw new Error("Expected object expression");
    }
    return expr;
  }

  it("should validate safe object expressions", () => {
    const code = `({
      name: "test",
      age: 42,
      tags: ["a", "b"]
    })`;
    const objExpr = parseObjectExpression(code);
    const result = validateObjectExpression(objExpr, 0, config);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("should reject computed properties when not allowed", () => {
    const code = `({
      ["computed"]: "value"
    })`;
    const objExpr = parseObjectExpression(code);
    const result = validateObjectExpression(objExpr, 0, config);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Computed properties are not allowed"
    );
  });

  it("should reject too many properties", () => {
    const customConfig = createTestConfig({ maxPropertiesPerObject: 1 });
    const code = `({ a: 1, b: 2 })`;
    const objExpr = parseObjectExpression(code);
    const result = validateObjectExpression(objExpr, 0, customConfig);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Object exceeds maximum property count of 1"
    );
  });

  it("should reject object exceeding max depth", () => {
    const customConfig = createTestConfig({ maxObjectDepth: 1 });
    const code = `({
      nested: {
        another: "value"
      }
    })`;
    const objExpr = parseObjectExpression(code);
    const result = validateObjectExpression(objExpr, 0, customConfig);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Object exceeds maximum nesting depth"
    );
  });

  it("should reject unsafe property names (deniedProperties)", () => {
    const code = `({
      constructor: "test"
    })`;
    const objExpr = parseObjectExpression(code);
    const result = validateObjectExpression(objExpr, 0, config);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Property name 'constructor' is not allowed"
    );
    expect(result.issues[0].severity).toBe(IssueSeverity.WARNING);
  });

  it("should reject property name starting with a denied prefix", () => {
    const customConfig = createTestConfig({
      propertySafety: {
        ...config.propertySafety,
        deniedPrefixes: ["_"],
      },
    });
    const code = `({
      _secret: "data"
    })`;
    const objExpr = parseObjectExpression(code);
    const result = validateObjectExpression(objExpr, 0, customConfig);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Property name '_secret' uses a forbidden prefix"
    );
  });
});
