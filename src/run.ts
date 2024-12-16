import * as fs from "fs";
import * as path from "path";
import { stdin as input } from "node:process";
import * as readline from "node:readline";
import clipboardy from "clipboardy";
import { validateZodSchema } from ".";
import { extremelySafeConfig, mediumConfig, relaxedConfig } from "./types";

interface CliOptions {
  stdin: boolean;
  clipboard: boolean;
  config: "extremelySafe" | "medium" | "relaxed";
  cleanOnly: boolean;
  json: boolean;
  help: boolean;
}

async function readFromStdin(): Promise<string> {
  const rl = readline.createInterface({ input });
  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }
  return lines.join("\n");
}

function printHelp(): void {
  console.log(`Usage: zodsheriff [options] [file]

Options:
  --stdin          Read schema from standard input
  --clipboard      Read schema from system clipboard
  --config <level> Set validation config: extremelySafe | medium | relaxed (default: relaxed)
  --clean-only     Output only the cleaned schema
  --json          Output result in JSON format
  --help          Show this help message

Examples:
  zodsheriff schema.ts
  zodsheriff --stdin < schema.ts
  zodsheriff --clipboard
  zodsheriff --config medium schema.ts
  zodsheriff --clean-only schema.ts`);
}

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

    const result = await validateZodSchema(
      schemaCode,
      configMap[options.config]
    );

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

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
