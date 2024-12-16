import { Node } from "@babel/types";

/**
 * Represents a validation issue found during processing
 */
export interface Issue {
  line: number;
  column?: number;
  message: string;
  nodeType: string;
  suggestion?: string;
  severity: IssueSeverity;
  source?: string;
}

/**
 * Severity levels for validation issues
 */
export enum IssueSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

/**
 * Class to manage validation issues and reporting
 */
export class IssueReporter {
  private issues: Issue[] = [];

  /**
   * Reports a new validation issue
   */
  public reportIssue(
    node: Node,
    message: string,
    nodeType: string,
    severity: IssueSeverity = IssueSeverity.ERROR,
    suggestion?: string
  ): void {
    this.issues.push({
      line: node.loc?.start.line ?? -1,
      column: node.loc?.start.column,
      message,
      nodeType,
      suggestion,
      severity,
      source: this.getSourceSnippet(node),
    });
  }

  /**
   * Gets all reported issues
   */
  public getIssues(): Issue[] {
    return [...this.issues];
  }

  /**
   * Gets issues filtered by severity
   */
  public getIssuesBySeverity(severity: IssueSeverity): Issue[] {
    return this.issues.filter((issue) => issue.severity === severity);
  }

  /**
   * Checks if there are any issues of ERROR severity
   */
  public hasErrors(): boolean {
    return this.issues.some((issue) => issue.severity === IssueSeverity.ERROR);
  }

  /**
   * Clears all reported issues
   */
  public clear(): void {
    this.issues = [];
  }

  /**
   * Gets a formatted report of all issues
   */
  public getFormattedReport(): string {
    return this.issues.map((issue) => this.formatIssue(issue)).join("\n\n");
  }

  private formatIssue(issue: Issue): string {
    const location = issue.column
      ? `${issue.line}:${issue.column}`
      : `line ${issue.line}`;

    let report = `${issue.severity.toUpperCase()}: ${issue.message} (${
      issue.nodeType
    }) at ${location}`;

    if (issue.source) {
      report += `\n${issue.source}`;
    }

    if (issue.suggestion) {
      report += `\nSuggestion: ${issue.suggestion}`;
    }

    return report;
  }

  private getSourceSnippet(node: Node): string | undefined {
    // Implementation would require access to source code
    // Could be injected through constructor
    return undefined;
  }
}

/**
 * Global issue reporter instance
 * Could also be instantiated per validation run if needed
 */
export const globalIssueReporter = new IssueReporter();

/**
 * Convenience function for reporting issues
 */
export function reportIssue(
  node: Node,
  message: string,
  nodeType: string,
  suggestion?: string
): void {
  globalIssueReporter.reportIssue(
    node,
    message,
    nodeType,
    IssueSeverity.ERROR,
    suggestion
  );
}
