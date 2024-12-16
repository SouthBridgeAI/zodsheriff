#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { stdin as input } from "node:process";
import * as readline from "node:readline";
import { extremelySafeConfig, mediumConfig, relaxedConfig } from "./types";
import clipboardy from "clipboardy";
import { validateZodSchema } from ".";

interface CliOptions {
  stdin: boolean;
  clipboard: boolean;
  config: "extremelySafe" | "medium" | "relaxed";
  output?: string;
  cleanOnly: boolean;
  json: boolean;
  help: boolean;
}

function printHelp() {
  console.log(`Usage: run [options] [file]

Options:
  --stdin          Read schema from standard input
  --clipboard      Read schema from system clipboard
  --config <level> Set validation config: extremelySafe | medium | relaxed (default: relaxed)
  --output <file>  Write cleaned schema to a file
  --clean-only     Output only the cleaned schema (no extra info)
  --json           Output the full result object in JSON (includes issues)
  --help           Show this help message

If no input source is specified, the first non-option argument is assumed to be a file path.

Examples:
  npx run mySchema.ts
  npx run --stdin < inputFile
  npx run --clipboard
  npx run mySchema.ts --config medium --output cleaned.ts
  npx run mySchema.ts --json
  npx run mySchema.ts --clean-only
`);
}

async function readFromStdin(): Promise<string> {
  const rl = readline.createInterface({ input });
  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    stdin: false,
    clipboard: false,
    config: "relaxed",
    cleanOnly: false,
    json: false,
    help: false,
  };

  let inputFilePath: string | undefined;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
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
      options.config = val as any;
      i++;
    } else if (arg === "--output") {
      options.output = args[i + 1];
      i++;
    } else if (arg === "--clean-only") {
      options.cleanOnly = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help") {
      options.help = true;
    } else if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else {
      // Non-option argument -> file path
      inputFilePath = arg;
    }
  }

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Determine input source
  let schemaCode: string;
  if (options.stdin) {
    schemaCode = await readFromStdin();
  } else if (options.clipboard) {
    schemaCode = await clipboardy.read();
  } else if (inputFilePath) {
    schemaCode = fs.readFileSync(path.resolve(inputFilePath), "utf8");
  } else {
    console.error(
      "No input specified. Use --stdin, --clipboard, or provide a file path."
    );
    process.exit(1);
  }

  // Select config
  let chosenConfig;
  if (options.config === "extremelySafe") chosenConfig = extremelySafeConfig;
  else if (options.config === "medium") chosenConfig = mediumConfig;
  else chosenConfig = relaxedConfig; // default

  const result = await validateZodSchema(schemaCode, chosenConfig);

  // Determine how to output
  const isTTY = process.stdout.isTTY;

  if (options.output && result.isValid) {
    fs.writeFileSync(options.output, result.cleanedCode, "utf8");
  }

  if (options.cleanOnly) {
    // If user wants clean-only, we print only cleaned schema if valid, else nothing
    if (result.isValid) {
      process.stdout.write(result.cleanedCode);
    } else {
      // no output if invalid, just errors to stderr
      console.error("Schema invalid. No cleaned code generated.");
    }
    process.exit(result.isValid ? 0 : 1);
  }

  if (options.json) {
    // JSON output
    process.stdout.write(JSON.stringify(result, null, 2));
    process.exit(result.isValid ? 0 : 1);
  }

  // Pretty print if TTY and no special output options
  if (isTTY) {
    if (result.isValid) {
      console.log("✅ Validation passed.");
      console.log("Cleaned schema:");
      console.log(result.cleanedCode);
    } else {
      console.log("❌ Validation failed.");
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
    // Non-TTY, no --json or --clean-only, just output the cleaned schema if valid, else full object
    if (result.isValid) {
      process.stdout.write(result.cleanedCode);
    } else {
      process.stdout.write(JSON.stringify(result, null, 2));
    }
  }

  process.exit(result.isValid ? 0 : 1);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
