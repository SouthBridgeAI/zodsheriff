// schema-groups.ts

/**
 * Represents a grouped schema with all its dependencies inlined.
 * Each group is a self-contained unit that can be used independently
 * of other schemas in the codebase.
 */
export interface SchemaGroup {
  /** Names of all schemas contained in this group */
  schemaNames: string[];

  /**
   * The combined, self-contained schema code.
   * All dependencies are inlined and properly ordered.
   */
  code: string;

  /**
   * Size and complexity metrics for this schema group.
   * Used for sorting and analysis.
   */
  metrics: {
    /** Number of individual schemas combined in this group */
    schemaCount: number;
    /** Total lines of code in the combined schema */
    totalLines: number;
    /**
     * Complexity score based on:
     * - Number of type definitions
     * - Nesting depth
     * - Use of complex types (objects, arrays)
     */
    complexity: number;
  };
}

/**
 * Configuration options for schema grouping functionality.
 */
export interface SchemaGroupingOptions {
  /**
   * Whether to attempt schema grouping.
   * If false, schemaGroups will not be generated.
   */
  enabled: boolean;

  /**
   * Whether to sort groups by size (largest first).
   * Sorting uses multiple metrics: schema count, complexity, and lines of code.
   */
  sortBySize?: boolean;
}

/**
 * Calculates size and complexity metrics for a schema group.
 *
 * @param code - The combined schema code to analyze
 * @param schemaCount - Number of schemas in the group
 * @returns Object containing various metrics about the schema group
 */
export function calculateGroupMetrics(
  code: string,
  schemaCount: number
): SchemaGroup["metrics"] {
  return {
    schemaCount,
    totalLines: code.split("\n").length,
    // Complexity heuristic based on:
    // - Number of type definitions (z.)
    // - Weighted count of complex types (objects worth more than arrays)
    complexity:
      code.split("z.").length +
      (code.match(/object\(/g) || []).length * 2 +
      (code.match(/array\(/g) || []).length * 1.5,
  };
}

/**
 * Sorts schema groups by size in descending order.
 *
 * Uses multiple metrics for sorting:
 * 1. Number of schemas in the group
 * 2. Complexity score
 * 3. Total lines of code
 *
 * @param groups - Array of schema groups to sort
 * @returns New array with groups sorted by size (largest first)
 */
export function sortSchemaGroups(groups: SchemaGroup[]): SchemaGroup[] {
  return groups.sort((a, b) => {
    // First compare by schema count
    if (a.metrics.schemaCount !== b.metrics.schemaCount) {
      return b.metrics.schemaCount - a.metrics.schemaCount;
    }
    // Then by complexity
    if (a.metrics.complexity !== b.metrics.complexity) {
      return b.metrics.complexity - a.metrics.complexity;
    }
    // Finally by total lines
    return b.metrics.totalLines - a.metrics.totalLines;
  });
}
