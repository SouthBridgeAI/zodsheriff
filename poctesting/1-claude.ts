import { parse } from "@typescript-eslint/parser";
import { TSESTree } from "@typescript-eslint/utils";
import fs from "fs/promises";
import clipboardy from "clipboardy";
import path from "path";

class ValidationError extends Error {
  constructor(message: string, public node: any) {
    super(message);
    this.name = "ValidationError";
  }
}

class ZodSchemaValidator {
  private allowedZodMethods = new Set([
    "string",
    "number",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "literal",
    "undefined",
    "null",
    "any",
    "unknown",
    "never",
    "void",
    "array",
    "object",
    "union",
    "discriminatedUnion",
    "intersection",
    "tuple",
    "record",
    "map",
    "set",
    "function",
    "lazy",
    "promise",
    "enum",
    "nativeEnum",
    "optional",
    "nullable",
    "nullish",
    "transform",
    "default",
    "catch",
    "preprocess",
    "postprocess",
    "refine",
    "superRefine",
    "pipe",
  ]);

  private allowedChainMethods = new Set([
    "optional",
    "nullable",
    "nullish",
    "array",
    "min",
    "or",
    "max",
    "length",
    "email",
    "url",
    "uuid",
    "regex",
    "transform",
    "default",
    "catch",
    "preprocess",
    "postprocess",
    "refine",
    "superRefine",
    "pipe",
    "brand",
    "describe",
  ]);

  validate(code: string): boolean {
    try {
      const ast = parse(code, {
        range: true,
        loc: true,
      });

      this.validateNode(ast);
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to parse code: ${error.message}`);
    }
  }

  private validateNode(node: TSESTree.Node): void {
    switch (node.type) {
      case "Program":
        this.validateProgram(node);
        break;
      case "CallExpression":
        this.validateCallExpression(node);
        break;
      case "MemberExpression":
        this.validateMemberExpression(node);
        break;
      default:
        this.validateChildren(node);
    }
  }

  private validateProgram(node: TSESTree.Program): void {
    for (const statement of node.body) {
      this.validateNode(statement);
    }
  }

  private validateCallExpression(node: TSESTree.CallExpression): void {
    if (node.callee.type === "MemberExpression") {
      const obj = node.callee.object;
      const prop = node.callee.property;

      if (
        obj.type === "Identifier" &&
        obj.name === "z" &&
        prop.type === "Identifier"
      ) {
        if (!this.allowedZodMethods.has(prop.name)) {
          throw new ValidationError(`Invalid Zod method: z.${prop.name}`, node);
        }
      } else if (
        prop.type === "Identifier" &&
        !this.allowedChainMethods.has(prop.name)
      ) {
        throw new ValidationError(`Invalid chain method: ${prop.name}`, node);
      }
    }

    for (const arg of node.arguments) {
      this.validateNode(arg);
    }
  }

  private validateMemberExpression(node: TSESTree.MemberExpression): void {
    this.validateNode(node.object);
    if (node.property.type === "Identifier") {
      const propName = node.property.name;
      if (
        !this.allowedZodMethods.has(propName) &&
        !this.allowedChainMethods.has(propName)
      ) {
        throw new ValidationError(`Invalid property access: ${propName}`, node);
      }
    }
  }

  private validateChildren(node: TSESTree.Node): void {
    for (const key in node) {
      const child = (node as any)[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === "object" && "type" in item) {
              this.validateNode(item);
            }
          }
        } else if ("type" in child) {
          this.validateNode(child);
        }
      }
    }
  }
}

class ConsoleReporter {
  success(message: string) {
    console.log("\x1b[32m✓\x1b[0m", message);
  }

  error(message: string) {
    console.error("\x1b[31m✗\x1b[0m", message);
  }

  info(message: string) {
    console.info("\x1b[36mℹ\x1b[0m", message);
  }
}

async function main() {
  const reporter = new ConsoleReporter();
  const validator = new ZodSchemaValidator();
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
ZodSheriff - Pure Zod Schema Validator

Usage:
  zodsheriff [options] [file]

Options:
  --clipboard, -c    Read schema from clipboard
  --file, -f        Read schema from file
  --help, -h        Show this help message

Examples:
  zodsheriff -c                 # Validate schema from clipboard
  zodsheriff -f schema.ts       # Validate schema from file
  zodsheriff schema.ts          # Validate schema from file (shorthand)
`);
    process.exit(0);
  }

  try {
    let schemaCode: string;

    if (args.includes("--clipboard") || args.includes("-c")) {
      reporter.info("Reading schema from clipboard...");
      schemaCode = await clipboardy.read();
    } else {
      const filePath =
        args.find((arg) => !arg.startsWith("-")) ||
        args[args.indexOf("--file") + 1] ||
        args[args.indexOf("-f") + 1];

      if (!filePath) {
        reporter.error(
          "No input source specified. Use --clipboard or provide a file path."
        );
        process.exit(1);
      }

      reporter.info(`Reading schema from ${filePath}...`);
      schemaCode = await fs.readFile(path.resolve(filePath), "utf-8");
    }

    if (!schemaCode.trim()) {
      reporter.error("Empty schema provided");
      process.exit(1);
    }

    const isValid = validator.validate(schemaCode);
    reporter.success("Schema validation passed! 🎉");
    process.exit(0);
  } catch (error) {
    if (error instanceof ValidationError) {
      reporter.error(`Schema validation failed: ${error.message}`);
    } else {
      reporter.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run the program
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
