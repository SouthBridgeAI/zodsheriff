import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import {
  type Node,
  type File,
  type Statement,
  type Expression,
  type VariableDeclaration,
  type VariableDeclarator,
  exportNamedDeclaration,
} from "@babel/types";
import type { ValidationConfig, ValidationResult } from "./types";
import { ResourceManager } from "./resource-manager";
import { IssueReporter, IssueSeverity } from "./reporting";
import { ChainValidator } from "./chain-validator";
import { ArgumentValidator } from "./argument-validator";
import {
  calculateGroupMetrics,
  SchemaGroup,
  sortSchemaGroups,
} from "./schema-groups";
import { SchemaDependencyAnalyzer } from "./schema-dependencies";

// Handle ESM default export
const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

/**
 * SchemaValidator class
 * Main class responsible for validating Zod schema definitions.
 * Coordinates validation of imports, schema structure, and method chains
 * while enforcing configured safety limits.
 */
export class SchemaValidator {
  private readonly resourceManager: ResourceManager;
  private readonly issueReporter: IssueReporter;
  private readonly chainValidator: ChainValidator;
  private readonly argumentValidator: ArgumentValidator;
  // NEW: track root-level schema names here
  private rootSchemaNames: Set<string> = new Set();

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
   * Main schema validation method
   *
   * Process:
   * 1. Parses input code to AST
   * 2. Validates imports
   * 3. Processes and validates declarations
   * 4. Removes invalid nodes
   * 5. Auto-exports valid schemas
   * 6. Generates cleaned output
   *
   * Notes:
   * - Returns isValid: false if any errors are found
   * - Still returns cleaned code containing valid schemas
   * - Reports all validation issues found
   *
   * @param schemaCode - The schema code to validate
   * @returns Promise<ValidationResult> with validation status, cleaned code, and issues
   */
  public async validateSchema(schemaCode: string): Promise<ValidationResult> {
    this.rootSchemaNames.clear();
    this.resourceManager.reset();
    this.issueReporter.clear();

    try {
      // 1) Parse the raw code
      const ast = await this.parseCode(schemaCode);
      if (!ast) {
        return {
          isValid: false,
          cleanedCode: "",
          issues: this.issueReporter.getIssues(),
          rootSchemaNames: Array.from(this.rootSchemaNames),
        };
      }

      let hasValidSchemas = false;
      let hasErrors = false;
      const nodesToRemove = new Set<Node>();

      // Check for required zod import (simplified)
      const hasZodImport = this.validateZodImport(ast);
      if (!hasZodImport) {
        hasErrors = true;
      }

      // 2) Traverse & remove invalid nodes
      traverse(ast, {
        ImportDeclaration: (path) => {
          if (path.node.source.value !== "zod") {
            this.issueReporter.reportIssue(
              path.node,
              `Invalid import from '${path.node.source.value}'. Only 'zod' imports are allowed.`,
              "ImportDeclaration",
              IssueSeverity.ERROR
            );
            nodesToRemove.add(path.node);
            hasErrors = true;
          }
        },

        VariableDeclaration: (path) => {
          const isValid = this.validateVariableDeclaration(path.node);

          if (!isValid) {
            nodesToRemove.add(path.node);
            hasErrors = true;
          } else {
            // Check if this variable is actually a "schema" (z.* or name includes "schema")
            const hasSchema = path.node.declarations.some((decl) =>
              this.isSchemaDeclaration(decl)
            );
            if (hasSchema) {
              hasValidSchemas = true;
              // Auto-export if not already
              if (
                !path.parent ||
                path.parent.type !== "ExportNamedDeclaration"
              ) {
                const exportDecl = exportNamedDeclaration(path.node, []);
                path.replaceWith(exportDecl);
              }
            } else {
              // Not a schema => remove
              nodesToRemove.add(path.node);
            }
          }
        },

        Statement: (path) => {
          if (!this.isAllowedStatement(path.node)) {
            this.issueReporter.reportIssue(
              path.node,
              `Invalid statement type: ${path.node.type}`,
              path.node.type,
              IssueSeverity.ERROR
            );
            nodesToRemove.add(path.node);
            hasErrors = true;
          }
        },
      });

      // Actually remove the invalid nodes
      traverse(ast, {
        enter: (path) => {
          if (nodesToRemove.has(path.node)) {
            path.remove();
          }
        },
      });

      // 3) Generate cleaned code if we have any valid schemas
      let cleanedCode = "";
      if (hasValidSchemas) {
        const generated = generate(ast, { comments: true, compact: false });
        cleanedCode = generated.code;
      }

      // 4) If unification is enabled, parse the *cleaned* code & unify
      let schemaGroups: SchemaGroup[] | undefined;
      if (hasValidSchemas && this.config.schemaUnification?.enabled) {
        // Re-parse the cleaned code
        const cleanedAst = await this.parseCode(cleanedCode);
        if (cleanedAst) {
          schemaGroups = await this.generateSchemaGroups(cleanedAst);
        }
      }

      return {
        isValid: !hasErrors,
        cleanedCode,
        issues: this.issueReporter.getIssues(),
        rootSchemaNames: Array.from(this.rootSchemaNames),
        schemaGroups,
      };
    } catch (error) {
      this.handleError(error);
      return {
        isValid: false,
        cleanedCode: "",
        issues: this.issueReporter.getIssues(),
        rootSchemaNames: Array.from(this.rootSchemaNames),
      };
    }
  }

  /**
   * Attempts to generate independent schema groups from the AST.
   *
   * This process:
   * 1. Analyzes dependencies between schemas
   * 2. Groups connected schemas together
   * 3. Generates combined, self-contained versions
   * 4. Calculates metrics and sorts by size
   *
   * @param ast - The parsed AST to analyze
   * @returns Array of schema groups, or undefined if grouping fails
   */
  private async generateSchemaGroups(
    ast: File
  ): Promise<SchemaGroup[] | undefined> {
    try {
      const analyzer = new SchemaDependencyAnalyzer(
        // pass config if you need it for the unwrapping
        this.config
      );
      analyzer.analyzeDependencies(ast);

      const groups = analyzer.getIndependentSchemaGroups();
      const schemaGroups = groups.map((group) => {
        // We'll keep the same logic for picking a root & generating combined code
        const code = analyzer.generateCombinedSchema(group);

        // Let's build the array of schema names in a stable order
        const groupNames = Array.from(group);
        return {
          schemaNames: groupNames,
          code,
          metrics: calculateGroupMetrics(code, group.size),
        };
      });

      return sortSchemaGroups(schemaGroups);
    } catch (error) {
      this.issueReporter.reportIssue(
        { type: "File", loc: { start: { line: 1, column: 0 } } } as Node,
        `Warning: Schema grouping failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "File",
        IssueSeverity.WARNING
      );
      return undefined;
    }
  }

  /**
   * Validates that the code properly imports 'z' from 'zod'
   *
   * Checks for:
   * - Presence of zod import
   * - Correct import specifier ('z')
   * - No other imports from other modules
   *
   * @param ast - The AST to validate
   * @returns boolean indicating if import is valid
   */
  private validateZodImport(ast: File): boolean {
    const hasZodImport = ast.program.body.some((node) => {
      if (node.type !== "ImportDeclaration") return false;
      if (node.source.value !== "zod") return false;

      return node.specifiers.some((spec) => {
        return (
          (spec.type === "ImportDefaultSpecifier" ||
            spec.type === "ImportSpecifier") &&
          spec.local.name === "z"
        );
      });
    });

    if (!hasZodImport) {
      this.issueReporter.reportIssue(
        { type: "File", loc: { start: { line: 1, column: 0 } } } as Node,
        "Missing 'z' import from 'zod'",
        "File",
        IssueSeverity.ERROR
      );
    }

    return hasZodImport;
  }

  /**
   * Validates a variable declaration node to ensure it meets schema requirements
   *
   * Validates that:
   * - Declaration uses 'const'
   * - Has a proper initializer (not undefined or missing)
   * - Schema initialization is valid
   *
   * @param node - The variable declaration to validate
   * @returns boolean indicating if the declaration is valid
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

    let isValid = true;
    for (const declarator of node.declarations) {
      // Check for missing initializer
      if (!declarator.init) {
        this.issueReporter.reportIssue(
          declarator,
          "Schema declaration must have an initializer",
          "VariableDeclarator",
          IssueSeverity.ERROR
        );
        isValid = false;
        continue;
      }

      // Check for undefined initializer
      if (
        declarator.init.type === "Identifier" &&
        declarator.init.name === "undefined"
      ) {
        this.issueReporter.reportIssue(
          declarator,
          "Schema declaration must have an initializer",
          "VariableDeclarator",
          IssueSeverity.ERROR
        );
        isValid = false;
        continue;
      }

      // For schema declarations, validate the initialization
      if (this.isSchemaDeclaration(declarator)) {
        if (!this.validateSchemaExpression(declarator.init)) {
          isValid = false;
        } else {
          // If it's valid, record the name of the variable as a root schema
          if (declarator.id.type === "Identifier") {
            this.rootSchemaNames.add(declarator.id.name);
          }
        }
      }
    }

    return isValid;
  }

  /**
   * Determines if a variable declarator represents a schema declaration
   *
   * Checks:
   * - Variable name (contains 'schema')
   * - Initialization pattern (z.* or schema-like call expression)
   *
   * @param declarator - The variable declarator to check
   * @returns boolean indicating if this is a schema declaration
   */
  private isSchemaDeclaration(declarator: VariableDeclarator): boolean {
    if (!declarator.init) return false;

    // Check for explicit schema naming
    if (
      declarator.id.type === "Identifier" &&
      declarator.id.name.toLowerCase().includes("schema")
    ) {
      return true;
    }

    // Check initialization pattern
    const init = declarator.init;
    return (
      init.type === "CallExpression" ||
      (init.type === "MemberExpression" &&
        init.object.type === "Identifier" &&
        init.object.name === "z")
    );
  }

  /**
   * Parses input code into an AST
   *
   * @param code - The code to parse
   * @returns Promise<File | null> The parsed AST or null if parsing fails
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
   * Validates a schema expression
   * Currently delegates to chain validator for method chain validation
   *
   * @param node - The expression to validate
   * @returns boolean indicating if the expression is valid
   */
  private validateSchemaExpression(node: Expression): boolean {
    return this.chainValidator.validateChain(node);
  }

  /**
   * Checks if a statement type is allowed in schema definitions
   *
   * @param node - The statement to check
   * @returns boolean indicating if the statement type is allowed
   */
  private isAllowedStatement(node: Statement): boolean {
    return (
      node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" ||
      node.type === "VariableDeclaration" ||
      node.type === "ExportDefaultDeclaration"
    );
  }

  /**
   * Handles errors during validation
   * Converts errors to validation issues
   *
   * @param error - The error to handle
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
 * Convenience function to validate a schema
 *
 * @param schemaCode - The schema code to validate
 * @param config - The validation configuration to use
 * @returns Promise<ValidationResult>
 */
export async function validateSchema(
  schemaCode: string,
  config: ValidationConfig
): Promise<ValidationResult> {
  const validator = new SchemaValidator(config);
  return validator.validateSchema(schemaCode);
}
