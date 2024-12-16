import {
  Node,
  CallExpression,
  MemberExpression,
  Identifier,
  Expression,
} from "@babel/types";
import { ValidationConfig } from "./types";
import { ResourceManager } from "./resource-manager";
import { IssueReporter, IssueSeverity } from "./reporting";
import { allowedChainMethods, allowedZodMethods } from "./zod-method-names";
import { ArgumentValidator } from "./argument-validator";

/**
 * Validates method chains in Zod schemas
 * Ensures proper chaining depth and only allowed methods are used
 */
export class ChainValidator {
  private readonly resourceManager: ResourceManager;
  private readonly issueReporter: IssueReporter;
  private readonly argumentValidator: ArgumentValidator;

  constructor(
    private readonly config: ValidationConfig,
    resourceManager?: ResourceManager,
    issueReporter?: IssueReporter,
    argumentValidator?: ArgumentValidator
  ) {
    this.resourceManager = resourceManager ?? new ResourceManager(config);
    this.issueReporter = issueReporter ?? new IssueReporter();
    this.argumentValidator =
      argumentValidator ??
      new ArgumentValidator(config, this.resourceManager, this.issueReporter);
  }

  /**
   * Validates a chain of method calls starting from a node
   * @param node - The starting node of the chain
   * @returns boolean indicating if the chain is valid
   */
  public validateChain(node: Node): boolean {
    try {
      return this.validateChainNode(node, 0);
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
   * Recursively validates a node in the method chain
   * @param node - Current node to validate
   * @param depth - Current depth in the chain
   * @returns boolean indicating if the node and its chain are valid
   */
  private validateChainNode(node: Node, depth: number): boolean {
    this.resourceManager.incrementNodeCount();
    this.resourceManager.trackDepth(depth, "chain");

    if (isIdentifier(node)) {
      return this.validateIdentifier(node);
    }

    if (isMemberExpression(node)) {
      return this.validateMemberExpression(node, depth);
    }

    if (isCallExpression(node)) {
      return this.validateCallExpression(node, depth);
    }

    this.issueReporter.reportIssue(
      node,
      `Unexpected node type in chain: ${node.type}`,
      node.type,
      IssueSeverity.ERROR
    );
    return false;
  }

  /**
   * Validates a call expression node (e.g., z.string(), .optional())
   */
  private validateCallExpression(node: CallExpression, depth: number): boolean {
    // Validate the callee first
    const callee = node.callee as Expression;

    if (!this.validateChainNode(callee, depth + 1)) {
      return false;
    }

    // Get the method name being called
    const methodName = this.getMethodName(callee);
    if (!methodName) {
      this.issueReporter.reportIssue(
        node,
        "Unable to determine method name",
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    // Validate method arguments if needed
    if (this.requiresArgumentValidation(methodName)) {
      return this.validateMethodArguments(node, methodName);
    }

    return true;
  }

  /**
   * Validates a member expression (e.g., z.string, .optional)
   */
  private validateMemberExpression(
    node: MemberExpression,
    depth: number
  ): boolean {
    if (node.computed) {
      this.issueReporter.reportIssue(
        node,
        "Computed properties not allowed in chain",
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    // Validate the object part of the member expression
    if (!this.validateChainNode(node.object, depth + 1)) {
      return false;
    }

    // Validate the property name
    if (!isIdentifier(node.property)) {
      this.issueReporter.reportIssue(
        node.property,
        "Property must be an identifier",
        node.property.type,
        IssueSeverity.ERROR
      );
      return false;
    }

    const methodName = node.property.name;
    if (!this.isMethodAllowed(methodName)) {
      this.issueReporter.reportIssue(
        node,
        `Method not allowed in chain: ${methodName}`,
        node.type,
        IssueSeverity.ERROR,
        "Use only allowed Zod methods"
      );
      return false;
    }

    return true;
  }

  /**
   * Validates an identifier node (should be 'z')
   */
  private validateIdentifier(node: Identifier): boolean {
    if (node.name !== "z") {
      this.issueReporter.reportIssue(
        node,
        `Chain must start with 'z', found: ${node.name}`,
        node.type,
        IssueSeverity.ERROR
      );
      return false;
    }
    return true;
  }

  /**
   * Gets the method name from a node
   */
  private getMethodName(node: Expression): string | null {
    if (isIdentifier(node)) {
      return node.name;
    }
    if (isMemberExpression(node) && isIdentifier(node.property)) {
      return node.property.name;
    }
    return null;
  }

  /**
   * Checks if a method name is allowed
   */
  private isMethodAllowed(methodName: string): boolean {
    return (
      allowedZodMethods.has(methodName) || allowedChainMethods.has(methodName)
    );
  }

  /**
   * Checks if a method requires argument validation
   */
  private requiresArgumentValidation(methodName: string): boolean {
    // Add methods that need argument validation
    return ["refine", "transform", "pipe"].includes(methodName);
  }

  /**
   * Validates arguments for specific methods
   */
  private validateMethodArguments(
    node: CallExpression,
    methodName: string
  ): boolean {
    return this.argumentValidator.validateMethodArguments(node, methodName);
  }
}

// Type guards
function isIdentifier(node: Node): node is Identifier {
  return node.type === "Identifier";
}

function isMemberExpression(node: Node): node is MemberExpression {
  return node.type === "MemberExpression";
}

function isCallExpression(node: Node): node is CallExpression {
  return node.type === "CallExpression";
}
