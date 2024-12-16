import { IssueReporter, IssueSeverity } from "../src/reporting";
import { Node } from "@babel/types";

describe("IssueReporter", () => {
  let reporter: IssueReporter;

  beforeEach(() => {
    reporter = new IssueReporter();
  });

  it("should report issues correctly", () => {
    const dummyNode: Node = {
      type: "Identifier",
      loc: { start: { line: 5, column: 10 } },
    } as any;
    reporter.reportIssue(
      dummyNode,
      "Test message",
      "Identifier",
      IssueSeverity.WARNING,
      "Try something else"
    );
    const issues = reporter.getIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe("Test message");
    expect(issues[0].line).toBe(5);
    expect(issues[0].column).toBe(10);
    expect(issues[0].severity).toBe(IssueSeverity.WARNING);
    expect(issues[0].suggestion).toBe("Try something else");
  });

  it("should get formatted report", () => {
    const dummyNode: Node = {
      type: "CallExpression",
      loc: { start: { line: 1, column: 1 } },
    } as any;
    reporter.reportIssue(
      dummyNode,
      "Another message",
      "CallExpression",
      IssueSeverity.ERROR
    );
    const report = reporter.getFormattedReport();
    expect(report).toContain("ERROR: Another message (CallExpression) at 1:1");
  });

  it("should filter issues by severity", () => {
    const node: Node = {
      type: "Literal",
      loc: { start: { line: 2, column: 3 } },
    } as any;
    reporter.reportIssue(node, "Error issue", "Literal", IssueSeverity.ERROR);
    reporter.reportIssue(
      node,
      "Warning issue",
      "Literal",
      IssueSeverity.WARNING
    );

    const errors = reporter.getIssuesBySeverity(IssueSeverity.ERROR);
    const warnings = reporter.getIssuesBySeverity(IssueSeverity.WARNING);

    expect(errors).toHaveLength(1);
    expect(warnings).toHaveLength(1);
  });

  it("should detect errors with hasErrors", () => {
    const node: Node = {
      type: "Literal",
      loc: { start: { line: 2, column: 2 } },
    } as any;
    expect(reporter.hasErrors()).toBe(false);
    reporter.reportIssue(node, "Some error", "Literal", IssueSeverity.ERROR);
    expect(reporter.hasErrors()).toBe(true);
  });

  it("should clear issues", () => {
    const node: Node = {
      type: "Literal",
      loc: { start: { line: 3, column: 4 } },
    } as any;
    reporter.reportIssue(node, "Some issue", "Literal", IssueSeverity.ERROR);
    expect(reporter.getIssues()).toHaveLength(1);
    reporter.clear();
    expect(reporter.getIssues()).toHaveLength(0);
  });
});
