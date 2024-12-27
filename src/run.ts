#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { stdin as input } from "node:process";
import * as readline from "node:readline";
import clipboardy from "clipboardy";
import { validateZodSchema } from ".";
import {
  extremelySafeConfig,
  mediumConfig,
  relaxedConfig,
  ValidationResult,
} from "./types";

/**
 * CLI options interface including new unified schema functionality
 */
interface CliOptions {
  stdin: boolean;
  clipboard: boolean;
  config: "extremelySafe" | "medium" | "relaxed";
  cleanOnly: boolean;
  json: boolean;
  help: boolean;
  getUnifiedLargest: boolean; // New option for getting largest unified schema
}

/**
 * Reads input from stdin line by line
 * @returns Promise<string> Combined input lines
 */
async function readFromStdin(): Promise<string> {
  const rl = readline.createInterface({ input });
  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }
  return lines.join("\n");
}

/**
 * Prints CLI help information including new unified schema option
 */
function printHelp(): void {
  console.log(`Usage: zodsheriff [options] [file]

Options:
  --stdin             Read schema from standard input
  --clipboard         Read schema from system clipboard
  --config <level>    Set validation config: extremelySafe | medium | relaxed (default: relaxed)
  --clean-only        Output only the cleaned schema
  --json             Output result in JSON format
  --getUnifiedLargest Output the largest unified schema to stdout (if available)
  --help             Show this help message

Examples:
  zodsheriff schema.ts
  zodsheriff --stdin < schema.ts
  zodsheriff --clipboard
  zodsheriff --config medium schema.ts
  zodsheriff --clean-only schema.ts
  zodsheriff --getUnifiedLargest schema.ts > unified.ts`);
}

/**
 * Reads input from various sources based on CLI options
 * @param options CLI options object
 * @param inputFilePath Optional file path for input
 * @returns Promise<string> Input content
 */
async function readInput(
  options: CliOptions,
  inputFilePath?: string
): Promise<string> {
  if (options.stdin) {
    return readFromStdin();
  }
  if (options.clipboard) {
    return clipboardy.read();
  }
  if (inputFilePath) {
    return fs.readFileSync(path.resolve(inputFilePath), "utf8");
  }
  throw new Error(
    "No input specified. Use --stdin, --clipboard, or provide a file path."
  );
}

/**
 * Gets the largest unified schema from validation results
 * @param result Validation result object
 * @returns string | null The largest unified schema or null if not available
 */
function getLargestUnifiedSchema(result: ValidationResult): string | null {
  if (!result.schemaGroups || result.schemaGroups.length === 0) {
    return null;
  }

  // Schema groups are already sorted by size, so return the first one
  return result.schemaGroups[0].code;
}

/**
 * Main CLI execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    stdin: false,
    clipboard: false,
    config: "relaxed",
    cleanOnly: false,
    json: false,
    help: false,
    getUnifiedLargest: false,
  };

  let inputFilePath: string | undefined;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--stdin") {
      options.stdin = true;
    } else if (arg === "--clipboard") {
      options.clipboard = true;
    } else if (arg === "--config") {
      const val = args[i + 1];
      if (!val || !["extremelySafe", "medium", "relaxed"].includes(val)) {
        console.error(
          "Invalid config value. Must be one of: extremelySafe, medium, relaxed"
        );
        process.exit(1);
      }
      options.config = val as CliOptions["config"];
      i++;
    } else if (arg === "--clean-only") {
      options.cleanOnly = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--getUnifiedLargest") {
      options.getUnifiedLargest = true;
    } else if (!arg.startsWith("--")) {
      inputFilePath = arg;
    }
  }

  try {
    const schemaCode = await readInput(options, inputFilePath);
    const configMap = {
      extremelySafe: extremelySafeConfig,
      medium: mediumConfig,
      relaxed: relaxedConfig,
    };

    // Enable schema unification if using --getUnifiedLargest
    const configWithUnification = {
      ...configMap[options.config],
      schemaUnification: options.getUnifiedLargest
        ? { enabled: true }
        : undefined,
    };

    const result = await validateZodSchema(schemaCode, configWithUnification);

    // Handle --getUnifiedLargest option
    if (options.getUnifiedLargest) {
      const largestSchema = getLargestUnifiedSchema(result);
      if (largestSchema) {
        // Output only the schema code to stdout for piping
        console.log(largestSchema);
        process.exit(0);
      } else {
        console.error("No unified schema available.");
        process.exit(1);
      }
    }

    // Handle other output options
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.isValid ? 0 : 1);
    }

    if (options.cleanOnly) {
      if (result.cleanedCode) {
        console.log(result.cleanedCode);
        process.exit(0);
      }
      console.error("No cleaned code generated due to validation errors.");
      process.exit(1);
    }

    // Standard output
    if (!result.isValid) {
      console.log("❌ Validation failed.");
      if (result.issues.length > 0) {
        console.log("Issues:");
        for (const issue of result.issues) {
          console.log(
            `- ${issue.severity.toUpperCase()}: ${issue.message} (at line ${
              issue.line
            }, node: ${issue.nodeType})`
          );
        }
      }
    } else {
      console.log("✅ Validation passed.");
    }

    if (result.cleanedCode) {
      console.log("Cleaned schema:");
      console.log(result.cleanedCode);
    }

    process.exit(result.isValid ? 0 : 1);
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Error handling wrapper for the main function
main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
