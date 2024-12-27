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
  SchemaUnificationOptions,
} from "./types";

// Type definitions for CLI options
interface CliOptions {
  stdin: boolean;
  clipboard: boolean;
  config: "extremelySafe" | "medium" | "relaxed";
  cleanOnly: boolean;
  json: boolean;
  help: boolean;
  getUnifiedLargest: boolean;
  unwrapArrays: boolean;
  inputFile?: string;
}

// Default CLI options
const defaultOptions: CliOptions = {
  stdin: false,
  clipboard: false,
  config: "relaxed",
  cleanOnly: false,
  json: false,
  help: false,
  getUnifiedLargest: false,
  unwrapArrays: false,
};

/**
 * Parses command line arguments into structured options
 */
function parseArgs(args: string[]): CliOptions {
  const options = { ...defaultOptions };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--help":
        options.help = true;
        break;
      case "--stdin":
        options.stdin = true;
        break;
      case "--clipboard":
        options.clipboard = true;
        break;
      case "--config":
        const val = args[++i];
        if (!val || !["extremelySafe", "medium", "relaxed"].includes(val)) {
          throw new Error(
            "Invalid config value. Must be one of: extremelySafe, medium, relaxed"
          );
        }
        options.config = val as CliOptions["config"];
        break;
      case "--clean-only":
        options.cleanOnly = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--getUnifiedLargest":
        options.getUnifiedLargest = true;
        break;
      case "--unwrapArrays":
        options.unwrapArrays = true;
        break;
      default:
        if (!arg.startsWith("--")) {
          options.inputFile = arg;
        }
    }
  }

  return options;
}

/**
 * Prints CLI help information
 */
function printHelp(): void {
  console.log(`Usage: zodsheriff [options] [file]

Options:
  --stdin             Read schema from standard input
  --clipboard         Read schema from system clipboard
  --config <level>    Set validation config: extremelySafe | medium | relaxed (default: relaxed)
  --clean-only        Output only the cleaned schema
  --json             Output result in JSON format
  --getUnifiedLargest Output the largest unified schema to stdout
  --unwrapArrays     Unwrap top-level array schemas when using --getUnifiedLargest
  --help             Show this help message

Examples:
  zodsheriff schema.ts
  zodsheriff --stdin < schema.ts
  zodsheriff --clipboard
  zodsheriff --config medium schema.ts
  zodsheriff --clean-only schema.ts
  zodsheriff --getUnifiedLargest --unwrapArrays schema.ts > unified.ts`);
}

/**
 * Reads input from various sources based on CLI options
 */
async function readInput(options: CliOptions): Promise<string> {
  if (options.stdin) {
    const rl = readline.createInterface({ input });
    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
    }
    return lines.join("\n");
  }

  if (options.clipboard) {
    return clipboardy.read();
  }

  if (options.inputFile) {
    return fs.readFileSync(path.resolve(options.inputFile), "utf8");
  }

  throw new Error(
    "No input specified. Use --stdin, --clipboard, or provide a file path."
  );
}

/**
 * Gets configuration based on CLI options
 */
function getValidationConfig(options: CliOptions) {
  const configMap = {
    extremelySafe: extremelySafeConfig,
    medium: mediumConfig,
    relaxed: relaxedConfig,
  };

  const baseConfig = configMap[options.config];

  // Add schema unification options if needed
  const schemaUnification: SchemaUnificationOptions | undefined =
    options.getUnifiedLargest
      ? {
          enabled: true,
          unwrapArrayRoot: options.unwrapArrays,
        }
      : undefined;

  return {
    ...baseConfig,
    schemaUnification,
  };
}

/**
 * Gets the largest unified schema from validation results
 */
function getLargestUnifiedSchema(result: ValidationResult): string | null {
  if (!result.schemaGroups || result.schemaGroups.length === 0) {
    return null;
  }

  // Schema groups are already sorted by size, so return the first one
  return result.schemaGroups[0].code;
}

/**
 * Handles the output based on CLI options and validation result
 */
function handleOutput(options: CliOptions, result: ValidationResult): void {
  if (options.getUnifiedLargest) {
    const largestSchema = getLargestUnifiedSchema(result);
    if (largestSchema) {
      console.log(largestSchema);
      process.exit(0);
    } else {
      console.error("No unified schema available.");
      process.exit(1);
    }
  }

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
}

/**
 * Main CLI execution function
 */
async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      printHelp();
      process.exit(0);
    }

    const schemaCode = await readInput(options);
    const config = getValidationConfig(options);
    const result = await validateZodSchema(schemaCode, config);
    handleOutput(options, result);
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
