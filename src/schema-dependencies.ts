// schema-dependencies.ts

import { Node, VariableDeclarator, Identifier } from "@babel/types";
import traverse from "@babel/traverse";

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

  /**
   * Analyzes the AST to find all schema dependencies.
   *
   * Tracks both direct dependencies (schemas used within a schema)
   * and reverse dependencies (which schemas use this schema).
   *
   * @param ast - The AST to analyze
   */
  public analyzeDependencies(ast: Node): void {
    traverse(ast, {
      VariableDeclarator: (path) => {
        if (path.node.id.type === "Identifier") {
          const schemaName = path.node.id.name;
          const deps = new Set<string>();

          // Track all schema references within this declaration
          path.traverse({
            Identifier: (innerPath) => {
              const name = innerPath.node.name;
              if (name !== schemaName && this.dependencies.has(name)) {
                deps.add(name);
              }
            },
          });

          this.dependencies.set(schemaName, {
            dependencies: deps,
            code: path.getSource(),
            node: path.node,
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
    });
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
    const orderedSchemas: string[] = [];
    const added = new Set<string>();

    // Add schemas in dependency order
    const addSchema = (name: string) => {
      if (added.has(name)) return;

      const info = this.dependencies.get(name);
      if (!info) return;

      // Add dependencies first
      info.dependencies.forEach((dep) => {
        if (group.has(dep)) {
          addSchema(dep);
        }
      });

      orderedSchemas.push(info.code);
      added.add(name);
    };

    // Process each schema in the group
    group.forEach((name) => addSchema(name));

    return orderedSchemas.join("\n\n");
  }
}
