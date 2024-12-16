import { ChainValidator } from "../src/chain-validator";
import { TestResourceManager, createTestConfig } from "./test-utils";
import { parse } from "@babel/parser";
import { ExpressionStatement, Node } from "@babel/types";
import { IssueReporter } from "../src/reporting";
import { ArgumentValidator } from "../src/argument-validator";

describe("ChainValidator", () => {
  let validator: ChainValidator;
  let resourceManager: TestResourceManager;
  let issueReporter: IssueReporter;
  let argumentValidator: ArgumentValidator;

  beforeEach(() => {
    const config = createTestConfig();
    resourceManager = new TestResourceManager(config);
    issueReporter = new IssueReporter();
    argumentValidator = new ArgumentValidator(
      config,
      resourceManager,
      issueReporter
    );
    validator = new ChainValidator(
      config,
      resourceManager,
      issueReporter,
      argumentValidator
    );
  });

  function parseExpression(code: string): Node {
    const ast = parse(code, { sourceType: "module", plugins: ["typescript"] });
    const stmt = ast.program.body[0] as ExpressionStatement;
    return stmt.expression;
  }

  it("should validate a simple chain starting with z", () => {
    const node = parseExpression(`z.string()`);
    const result = validator.validateChain(node);
    expect(result).toBe(true);
    expect(issueReporter.getIssues()).toHaveLength(0);
  });

  it("should fail if chain does not start with z identifier", () => {
    const node = parseExpression(`x.string()`);
    const result = validator.validateChain(node);
    expect(result).toBe(false);
    const issues = issueReporter.getIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Chain must start with 'z'");
  });

  it("should validate allowed zod methods in chain", () => {
    const node = parseExpression(`z.string().min(5).max(10)`);
    const result = validator.validateChain(node);
    expect(result).toBe(true);
    expect(issueReporter.getIssues()).toHaveLength(0);
  });

  it("should report issue for not allowed method in chain", () => {
    const node = parseExpression(`z.string().someForbiddenMethod()`);
    const result = validator.validateChain(node);
    expect(result).toBe(false);
    const issues = issueReporter.getIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Method not allowed in chain");
  });

  it("should handle deeply chained calls within maxChainDepth", () => {
    // Allowed depth is 10 in relaxed config, try a chain of length 5
    const node = parseExpression(`z.string().min(1).max(2).trim().email()`);
    const result = validator.validateChain(node);
    expect(result).toBe(true);
  });

  it("should fail if chain depth exceeds maxChainDepth", () => {
    // Set a lower maxChainDepth
    const config = createTestConfig({ maxChainDepth: 2 });
    validator = new ChainValidator(
      config,
      resourceManager,
      issueReporter,
      argumentValidator
    );

    const node = parseExpression(`z.string().min(1).max(2).trim()`);
    const result = validator.validateChain(node);
    expect(result).toBe(false);

    const issues = issueReporter.getIssues();
    expect(
      issues.some((issue) =>
        issue.message.includes("Chain nesting depth exceeded")
      )
    ).toBe(true);
  });

  it("should report error for computed member expression properties", () => {
    const node = parseExpression(`z.string()[methodName]()`);
    const result = validator.validateChain(node);
    expect(result).toBe(false);
    const issues = issueReporter.getIssues();
    expect(issues[0].message).toContain(
      "Computed properties not allowed in chain"
    );
  });
});
