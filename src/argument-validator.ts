import {
  Node,
  Expression,
  CallExpression,
  ArrowFunctionExpression,
  FunctionExpression,
  ArrayExpression,
  ObjectExpression,
  StringLiteral,
  RegExpLiteral,
  Identifier,
} from "@babel/types";
import { ValidationConfig } from "./types";
import { ResourceManager } from "./resource-manager";
import { IssueReporter, IssueSeverity } from "./reporting";
import { validateObjectExpression } from "./object-validator";
import safeRegex from "safe-regex";

/**
 * Validates arguments passed to Zod schema methods
 * Ensures arguments are safe and match expected patterns
 */
export class ArgumentValidator {
  private readonly resourceManager: ResourceManager;
  private readonly issueReporter: IssueReporter;

  constructor(
    private readonly config: ValidationConfig,
    resourceManager?: ResourceManager,
    issueReporter?: IssueReporter
  ) {
    this.resourceManager = resourceManager ?? new ResourceManager(config);
    this.issueReporter = issueReporter ?? new IssueReporter();
  }

  /**
   * Method-specific argument validation rules
   */
  private static readonly METHOD_RULES: Record<string, ArgumentRule> = {
    refine: {
      minArgs: 1,
      maxArgs: 2,
      allowFunction: true,
      allowSchema: false,
      validateFunction: true,
    },
    transform: {
      minArgs: 1,
      maxArgs: 1,
      allowFunction: true,
      allowSchema: false,
      validateFunction: true,
    },
    pipe: {
      minArgs: 1,
      maxArgs: 1,
      allowFunction: false,
      allowSchema: true,
      validateFunction: false,
    },
    regex: {
      minArgs: 1,
      maxArgs: 2,
      allowFunction: false,
      allowSchema: false,
      validateRegex: true,
    },
    // Add more method rules as needed
  };

  /**
   * Validates arguments for a specific method call
   */
  public validateMethodArguments(
    node: CallExpression,
    methodName: string
  ): boolean {
    const rules = ArgumentValidator.METHOD_RULES[methodName];
    if (!rules) {
      return true; // No specific rules for this method
    }

    try {
      // Check argument count
      if (!this.validateArgumentCount(node, rules)) {
        return false;
      }

      // Validate each argument
      return node.arguments.every((arg, index) =>
        this.validateArgument(arg, rules, methodName, index)
      );
    } catch (error) {
      if (error instanceof Error) {
        this.issueReporter.reportIssue(
          node,
          error.message,
          node.type,
          IssueSeverity.ERROR
        );
      }
      return false;
    }
  }

  /**
   * Validates a single argument against rules
   */
  private validateArgument(
    arg: Node,
    rules: ArgumentRule,
    methodName: string,
    index: number
  ): boolean {
    this.resourceManager.incrementNodeCount();

    // Handle different argument types
    if (isFunction(arg)) {
      return this.validateFunctionArgument(arg, rules);
    }

    if (isObjectExpression(arg)) {
      return validateObjectExpression(arg, 0, this.config, []).isValid;
    }

    if (isArrayExpression(arg)) {
      return this.validateArrayArgument(arg);
    }

    if (isLiteral(arg)) {
      return this.validateLiteralArgument(arg as Expression);
    }

    if (isIdentifier(arg)) {
      return this.validateIdentifierArgument(arg);
    }

    // Unknown argument type
    this.issueReporter.reportIssue(
      arg,
      `Unexpected argument type for method ${methodName}: ${arg.type}`,
      arg.type,
      IssueSeverity.ERROR
    );
    return false;
  }

  /**
   * Validates function arguments (for refine/transform)
   */
  private validateFunctionArgument(
    node: ArrowFunctionExpression | FunctionExpression,
    rules: ArgumentRule
  ): boolean {
    if (!rules.allowFunction) {
      this.issueReporter.reportIssue(
        node,
        "Function arguments not allowed for this method",
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    if (rules.validateFunction) {
      return this.validateFunctionBody(node);
    }

    return true;
  }

  /**
   * Validates function bodies for safety
   */
  private validateFunctionBody(
    node: ArrowFunctionExpression | FunctionExpression
  ): boolean {
    // Don't allow async functions
    if (node.async) {
      this.issueReporter.reportIssue(
        node,
        "Async functions not allowed in schema validation",
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    // Don't allow generators
    if (node.generator) {
      this.issueReporter.reportIssue(
        node,
        "Generator functions not allowed in schema validation",
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    // Validate function body
    return this.validateFunctionStatements(node.body);
  }

  /**
   * Validates statements within a function body
   */
  private validateFunctionStatements(node: Node): boolean {
    // TODO: Implement based on your security requirements
    return true; // Placeholder
  }

  /**
   * Validates array arguments
   */
  private validateArrayArgument(node: ArrayExpression): boolean {
    // Check array size
    if (node.elements.length > this.config.maxPropertiesPerObject) {
      this.issueReporter.reportIssue(
        node,
        `Array exceeds maximum size of ${this.config.maxPropertiesPerObject}`,
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    // Validate each element
    return node.elements.every((element) => {
      if (!element) return true; // Skip sparse array elements
      return this.validateArgument(
        element,
        { allowFunction: false, allowSchema: false },
        "array",
        0
      );
    });
  }

  /**
   * Validates literal arguments (string, number, boolean, etc.)
   */
  private validateLiteralArgument(node: Expression): boolean {
    if (isStringLiteral(node)) {
      return node.value.length <= this.config.maxStringLength;
    }

    if (isRegExpLiteral(node)) {
      return this.validateRegexLiteral(node);
    }

    // Other literals are generally safe
    return true;
  }

  /**
   * Validates regex literals for safety
   */
  private validateRegexLiteral(node: RegExpLiteral): boolean {
    try {
      // Check regex pattern length
      if (node.pattern.length > this.config.maxStringLength) {
        this.issueReporter.reportIssue(
          node,
          "Regex pattern too long",
          node.type,
          IssueSeverity.ERROR
        );
        return false;
      }

      if (!safeRegex(node.pattern)) {
        this.issueReporter.reportIssue(
          node,
          "Regex pattern is not safe (as reported by safe-regex)",
          node.type,
          IssueSeverity.ERROR
        );
        return false;
      }

      // Could add additional regex safety checks here
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates identifier arguments
   */
  private validateIdentifierArgument(node: Identifier): boolean {
    // Could add checks for specific identifiers here
    return true;
  }

  /**
   * Validates argument count against rules
   */
  private validateArgumentCount(
    node: CallExpression,
    rules: ArgumentRule
  ): boolean {
    const { minArgs, maxArgs } = rules;
    const argCount = node.arguments.length;

    if (minArgs !== undefined && argCount < minArgs) {
      this.issueReporter.reportIssue(
        node,
        `Too few arguments. Expected at least ${minArgs}, got ${argCount}`,
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    if (maxArgs !== undefined && argCount > maxArgs) {
      this.issueReporter.reportIssue(
        node,
        `Too many arguments. Expected at most ${maxArgs}, got ${argCount}`,
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    return true;
  }
}

/**
 * Rules for method argument validation
 */
interface ArgumentRule {
  minArgs?: number;
  maxArgs?: number;
  allowFunction?: boolean;
  allowSchema?: boolean;
  validateFunction?: boolean;
  validateRegex?: boolean;
}

// Type guards
function isFunction(
  node: Node
): node is ArrowFunctionExpression | FunctionExpression {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  );
}

function isObjectExpression(node: Node): node is ObjectExpression {
  return node.type === "ObjectExpression";
}

function isArrayExpression(node: Node): node is ArrayExpression {
  return node.type === "ArrayExpression";
}

function isStringLiteral(node: Node): node is StringLiteral {
  return node.type === "StringLiteral";
}

function isRegExpLiteral(node: Node): node is RegExpLiteral {
  return node.type === "RegExpLiteral";
}

function isLiteral(node: Node): boolean {
  return (
    node.type === "StringLiteral" ||
    node.type === "NumericLiteral" ||
    node.type === "BooleanLiteral" ||
    node.type === "RegExpLiteral" ||
    node.type === "NullLiteral"
  );
}

function isIdentifier(node: Node): node is Identifier {
  return node.type === "Identifier";
}
