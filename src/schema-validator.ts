import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import {
  Node,
  File,
  Statement,
  Expression,
  ImportDeclaration,
  VariableDeclaration,
  ExportNamedDeclaration,
} from "@babel/types";
import { ValidationConfig } from "./types";
import { ResourceManager } from "./resource-manager";
import { IssueReporter, IssueSeverity } from "./reporting";
import { ChainValidator } from "./chain-validator";
import { ArgumentValidator } from "./argument-validator";

/**
 * Main validator for Zod schemas
 * Coordinates all other validators and handles the overall validation process
 */
export class SchemaValidator {
  private readonly resourceManager: ResourceManager;
  private readonly issueReporter: IssueReporter;
  private readonly chainValidator: ChainValidator;
  private readonly argumentValidator: ArgumentValidator;

  constructor(
    private readonly config: ValidationConfig,
    resourceManager?: ResourceManager,
    issueReporter?: IssueReporter
  ) {
    this.resourceManager = resourceManager ?? new ResourceManager(config);
    this.issueReporter = issueReporter ?? new IssueReporter();
    this.chainValidator = new ChainValidator(
      config,
      this.resourceManager,
      this.issueReporter
    );
    this.argumentValidator = new ArgumentValidator(
      config,
      this.resourceManager,
      this.issueReporter
    );
  }

  /**
   * Validates and transforms a schema code string
   * @param schemaCode - The input schema code to validate
   * @returns Object containing cleaned code and any issues found
   */
  public async validateSchema(schemaCode: string): Promise<ValidationResult> {
    this.resourceManager.reset();
    this.issueReporter.clear();

    try {
      // Parse the code
      const ast = await this.parseCode(schemaCode);
      if (!ast) {
        return {
          isValid: false,
          cleanedCode: "",
          issues: this.issueReporter.getIssues(),
        };
      }

      // Validate the schema
      const isValid = await this.validateAst(ast);

      // Generate cleaned code if valid
      let cleanedCode = "";
      if (isValid) {
        const generated = generate(ast, {
          comments: true,
          compact: false,
        });
        cleanedCode = generated.code;
      }

      return {
        isValid,
        cleanedCode,
        issues: this.issueReporter.getIssues(),
      };
    } catch (error) {
      this.handleError(error);
      return {
        isValid: false,
        cleanedCode: "",
        issues: this.issueReporter.getIssues(),
      };
    }
  }

  /**
   * Parses input code into an AST
   */
  private async parseCode(code: string): Promise<File | null> {
    try {
      return parse(code.trim(), {
        sourceType: "module",
        plugins: ["typescript"],
        tokens: true,
      });
    } catch (error) {
      this.issueReporter.reportIssue(
        { type: "File", loc: { start: { line: 1, column: 0 } } } as Node,
        `Failed to parse schema: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "File",
        IssueSeverity.ERROR
      );
      return null;
    }
  }

  /**
   * Validates the entire AST
   */
  private async validateAst(ast: File): Promise<boolean> {
    return this.resourceManager.withTimeoutCheck(async () => {
      let isValid = true;

      // Check for zod import
      const hasZodImport = this.validateZodImport(ast);
      if (!hasZodImport) {
        isValid = false;
      }

      // Traverse and validate the AST
      traverse(ast, {
        ImportDeclaration: (path) => {
          // Only allow zod import
          if (path.node.source.value !== "zod") {
            this.issueReporter.reportIssue(
              path.node,
              `Invalid import from '${path.node.source.value}'. Only 'zod' imports are allowed.`,
              "ImportDeclaration",
              IssueSeverity.ERROR
            );
            isValid = false;
            path.remove();
          }
        },

        VariableDeclaration: (path) => {
          const validDecl = this.validateVariableDeclaration(path.node);
          if (!validDecl) {
            isValid = false;
            path.remove();
          }
        },

        ExportNamedDeclaration: (path) => {
          if (
            path.node.declaration &&
            path.node.declaration.type === "VariableDeclaration"
          ) {
            const validDecl = this.validateVariableDeclaration(
              path.node.declaration
            );
            if (!validDecl) {
              isValid = false;
              path.remove();
            }
          }
        },

        // Remove any other statements
        Statement: (path) => {
          if (!this.isAllowedStatement(path.node)) {
            this.issueReporter.reportIssue(
              path.node,
              `Invalid statement type: ${path.node.type}`,
              path.node.type,
              IssueSeverity.ERROR
            );
            isValid = false;
            path.remove();
          }
        },
      });

      return isValid;
    });
  }

  /**
   * Validates a variable declaration containing a schema
   */
  private validateVariableDeclaration(node: VariableDeclaration): boolean {
    // Only allow const declarations
    if (node.kind !== "const") {
      this.issueReporter.reportIssue(
        node,
        "Schema declarations must use 'const'",
        "VariableDeclaration",
        IssueSeverity.ERROR
      );
      return false;
    }

    // Validate each declarator
    return node.declarations.every((declarator) => {
      if (!declarator.init) {
        this.issueReporter.reportIssue(
          declarator,
          "Schema declaration must have an initializer",
          "VariableDeclarator",
          IssueSeverity.ERROR
        );
        return false;
      }

      return this.validateSchemaExpression(declarator.init);
    });
  }

  /**
   * Validates a schema expression
   */
  private validateSchemaExpression(node: Expression): boolean {
    // Validate the chain structure
    if (!this.chainValidator.validateChain(node)) {
      return false;
    }

    // Additional schema-specific validations could go here

    return true;
  }

  /**
   * Checks for valid zod import
   */
  private validateZodImport(ast: File): boolean {
    const hasZodImport = ast.program.body.some(
      (node) =>
        node.type === "ImportDeclaration" &&
        node.source.value === "zod" &&
        node.specifiers.some(
          (spec) =>
            spec.type === "ImportDefaultSpecifier" && spec.local.name === "z"
        )
    );

    if (!hasZodImport) {
      this.issueReporter.reportIssue(
        { type: "File", loc: { start: { line: 1, column: 0 } } } as Node,
        "Missing 'z' import from 'zod'",
        "File",
        IssueSeverity.ERROR
      );
      return false;
    }

    return true;
  }

  /**
   * Checks if a statement type is allowed
   */
  private isAllowedStatement(node: Statement): boolean {
    return (
      node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" ||
      node.type === "VariableDeclaration"
    );
  }

  /**
   * Handles errors during validation
   */
  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : "Unknown error";
    this.issueReporter.reportIssue(
      { type: "File", loc: { start: { line: 1, column: 0 } } } as Node,
      `Validation error: ${message}`,
      "File",
      IssueSeverity.ERROR
    );
  }
}

/**
 * Result of schema validation
 */
interface ValidationResult {
  isValid: boolean;
  cleanedCode: string;
  issues: Array<{
    line: number;
    column?: number;
    message: string;
    nodeType: string;
    severity: IssueSeverity;
    suggestion?: string;
  }>;
}

/**
 * Convenience function to validate a schema
 */
export async function validateSchema(
  schemaCode: string,
  config: ValidationConfig
): Promise<ValidationResult> {
  const validator = new SchemaValidator(config);
  return validator.validateSchema(schemaCode);
}
