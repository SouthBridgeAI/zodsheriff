// schema-dependencies.ts

import { parse } from "@babel/parser";
import { Node, VariableDeclarator, Expression } from "@babel/types";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import { ValidationConfig } from "./types";
import { IssueReporter, IssueSeverity } from "./reporting";

// Handle ESM default export
const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

/**
 * Information about a schema and its dependencies.
 */
interface SchemaDependencyInfo {
  /** Set of schema names this schema depends on */
  dependencies: Set<string>;
  /** Original source code of the schema */
  code: string;
  /** AST node representing the schema */
  node: Node;
}

/**
 * Analyzes dependencies between Zod schemas and helps generate
 * grouped, self-contained versions of the schemas.
 */
export class SchemaDependencyAnalyzer {
  /** Maps schema names to their dependency information */
  private dependencies: Map<string, SchemaDependencyInfo> = new Map();
  /** Reverse mapping of dependencies (what schemas reference this one) */
  private referenceMap: Map<string, Set<string>> = new Map();
  private readonly issueReporter: IssueReporter;

  constructor(
    private readonly config?: ValidationConfig,
    issueReporter?: IssueReporter
  ) {
    this.issueReporter = issueReporter ?? new IssueReporter();
  }

  /**
   * Analyzes the AST to find all schema dependencies.
   *
   * Tracks both direct dependencies (schemas used within a schema)
   * and reverse dependencies (which schemas use this schema).
   *
   * @param ast - The AST to analyze
   */
  public analyzeDependencies(ast: Node): void {
    const visitor = {
      VariableDeclarator: (node: VariableDeclarator) => {
        if (node.id.type === "Identifier") {
          const schemaName = node.id.name;
          const deps = new Set<string>();

          // Track all identifiers within this declaration
          this.visitNode(node.init, (n) => {
            if (
              n.type === "Identifier" &&
              n.name !== schemaName &&
              this.dependencies.has(n.name)
            ) {
              deps.add(n.name);
            }
          });

          this.dependencies.set(schemaName, {
            dependencies: deps,
            code: generate(node).code,
            node: node,
          });

          // Update reverse reference mapping
          deps.forEach((dep) => {
            if (!this.referenceMap.has(dep)) {
              this.referenceMap.set(dep, new Set());
            }
            this.referenceMap.get(dep)!.add(schemaName);
          });
        }
      },
    };

    this.visitNode(ast, (node) => {
      if (node.type === "VariableDeclarator") {
        visitor.VariableDeclarator(node);
      }
    });
  }

  /**
   * Recursively visits all nodes in the AST
   */
  private visitNode(
    node: Node | null | undefined,
    visitor: (node: Node) => void
  ): void {
    if (!node) return;

    visitor(node);

    // Visit all properties that might contain nodes
    for (const key of Object.keys(node)) {
      const child = (node as any)[key];

      if (Array.isArray(child)) {
        child.forEach((item) => {
          if (item && typeof item === "object" && "type" in item) {
            this.visitNode(item, visitor);
          }
        });
      } else if (child && typeof child === "object" && "type" in child) {
        this.visitNode(child, visitor);
      }
    }
  }

  public getDependencies(name: string): SchemaDependencyInfo | undefined {
    return this.dependencies.get(name);
  }

  public getReferenceMap(): Map<string, Set<string>> {
    return this.referenceMap;
  }

  /**
   * Finds groups of interconnected schemas that can be treated
   * as independent units.
   *
   * Two schemas are considered connected if:
   * - One references the other directly
   * - They share common dependencies
   * - They are part of the same dependency chain
   *
   * @returns Array of sets, where each set contains names of connected schemas
   */
  public getIndependentSchemaGroups(): Array<Set<string>> {
    const visited = new Set<string>();
    const groups: Array<Set<string>> = [];

    // For each schema
    for (const schemaName of this.dependencies.keys()) {
      if (!visited.has(schemaName)) {
        const group = new Set<string>();
        this.collectConnectedSchemas(schemaName, visited, group);
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Recursively collects all schemas connected to a given schema.
   *
   * @param schemaName - Name of the schema to start from
   * @param visited - Set of already visited schema names
   * @param group - Set to collect the connected schema names
   */
  private collectConnectedSchemas(
    schemaName: string,
    visited: Set<string>,
    group: Set<string>
  ): void {
    if (visited.has(schemaName)) return;

    visited.add(schemaName);
    group.add(schemaName);

    // Add dependencies (schemas this one uses)
    const deps = this.dependencies.get(schemaName)?.dependencies || new Set();
    deps.forEach((dep) => {
      this.collectConnectedSchemas(dep, visited, group);
    });

    // Add references (schemas that use this one)
    const refs = this.referenceMap.get(schemaName) || new Set();
    refs.forEach((ref) => {
      this.collectConnectedSchemas(ref, visited, group);
    });
  }

  /**
   * Generates a single, combined schema from a group of connected schemas.
   *
   * The combined schema:
   * - Includes all necessary dependencies
   * - Orders declarations correctly based on dependencies
   * - Is self-contained and can be used independently
   *
   * @param group - Set of schema names to combine
   * @returns Combined schema code with proper ordering
   */
  public generateCombinedSchema(group: Set<string>): string {
    // Find the root schema (the one that depends on others but isn't depended on)
    const rootSchema =
      Array.from(group).find((name) => {
        const deps = this.dependencies.get(name)!.dependencies;
        const refs = this.referenceMap.get(name) || new Set();
        return deps.size > 0 && refs.size === 0;
      }) || Array.from(group)[0];

    // Create a map of schema AST nodes for easy lookup
    const schemaMap = new Map<string, Node>();
    group.forEach((name) => {
      const info = this.dependencies.get(name);
      if (info) {
        schemaMap.set(name, info.node);
      }
    });

    // Clone the root schema AST to avoid modifying the original
    const rootNode = this.dependencies.get(rootSchema)?.node;
    if (!rootNode || rootNode.type !== "VariableDeclarator" || !rootNode.init) {
      return "";
    }

    // Function to recursively replace schema references with their definitions
    const replaceSchemaReferences = (node: Node): Node => {
      if (node.type === "Identifier" && schemaMap.has(node.name)) {
        // Get the schema definition for this reference
        const schemaNode = schemaMap.get(node.name);
        if (
          schemaNode &&
          schemaNode.type === "VariableDeclarator" &&
          schemaNode.init
        ) {
          // Return the schema definition (the part after the =)
          return replaceSchemaReferences(schemaNode.init);
        }
      }

      // Deep clone the node to avoid modifying original
      const clonedNode = { ...node };

      // Recursively process all properties that might contain nodes
      Object.keys(clonedNode).forEach((key) => {
        const child = (clonedNode as any)[key];

        if (Array.isArray(child)) {
          (clonedNode as any)[key] = child.map((item) =>
            item && typeof item === "object" && "type" in item
              ? replaceSchemaReferences(item)
              : item
          );
        } else if (child && typeof child === "object" && "type" in child) {
          (clonedNode as any)[key] = replaceSchemaReferences(child);
        }
      });

      return clonedNode;
    };

    // Replace all schema references in the root schema
    const inlinedSchema = replaceSchemaReferences(rootNode.init);

    // Generate code from the transformed AST
    let code = generate(inlinedSchema).code;

    if (this.config?.schemaUnification?.unwrapArrayRoot) {
      try {
        const topAst = parse(code, {
          sourceType: "module",
          plugins: ["typescript"],
        });

        // Check if we have a single expression that is z.array(...)
        if (
          topAst.program.body.length === 1 &&
          topAst.program.body[0].type === "ExpressionStatement" &&
          topAst.program.body[0].expression.type === "CallExpression"
        ) {
          const expr = topAst.program.body[0].expression;
          const callee = expr.callee;

          // Check if it's z.array
          if (
            callee.type === "MemberExpression" &&
            callee.object.type === "Identifier" &&
            callee.object.name === "z" &&
            callee.property.type === "Identifier" &&
            callee.property.name === "array" &&
            expr.arguments.length === 1 &&
            // Check that the argument is an Expression
            !(
              "type" in expr.arguments[0] &&
              expr.arguments[0].type === "SpreadElement"
            )
          ) {
            // Safely assert the argument as Expression
            const innerSchema = expr.arguments[0] as Expression;

            // Replace z.array(schema) with just schema
            topAst.program.body[0] = {
              type: "ExpressionStatement",
              expression: innerSchema,
              loc: expr.loc, // Preserve location info for error reporting
            };

            // Re-generate code
            code = generate(topAst).code;
          }
        }
      } catch (err) {
        // Use the issue reporter to log errors
        this.issueReporter.reportIssue(
          {
            type: "File",
            loc: { start: { line: 1, column: 0 } },
          } as Node,
          `Failed to unwrap array root schema: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
          "File",
          IssueSeverity.WARNING,
          "The array unwrapping operation failed but the schema is still valid"
        );
      }
    }

    return code;
  }
}
