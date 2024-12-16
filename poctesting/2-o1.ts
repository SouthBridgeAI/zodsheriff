import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import clipboardy from "clipboardy";
import * as fs from "fs";
import * as path from "path";
import {
  Node,
  File,
  isCallExpression,
  isIdentifier,
  VariableDeclarator,
  VariableDeclaration,
  Expression,
} from "@babel/types";

// Allowed Zod creation methods and chain methods (manually curated)
const allowedZodMethods = new Set([
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

const allowedChainMethods = new Set([
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

function isZodSchemaExpression(expr: Expression): boolean {
  // Check if expression is something like z.string() or z.object({}) with allowed chaining
  // We'll recursively check call chains.
  return validateZodExpression(expr);
}

function validateZodExpression(expr: Expression): boolean {
  // Base case: If this is a call expression that starts with z.<method>
  // and subsequently chains allowed methods, we consider it valid.
  if (isCallExpression(expr)) {
    const { callee } = expr;
    // The callee could be a chain of MemberExpressions ending with an Identifier
    // We'll walk it to ensure it's allowed.
    if (!validateZodCallee(callee)) return false;

    // Validate arguments recursively if they contain other Zod schemas
    for (const arg of expr.arguments) {
      // If arguments contain function calls or MemberExpressions, check them
      if (
        arg &&
        (isCallExpression(arg) ||
          arg.type === "MemberExpression" ||
          isIdentifier(arg))
      ) {
        if (!validateZodExpression(arg)) return false;
      }
    }
    return true;
  }

  // If it's just an identifier or literal, it's allowed (assuming it's part of zod schema construction)
  // But if we encounter something non-call, non-member that isn't 'z' or a known constant, we fail.
  if (isIdentifier(expr)) {
    // If it's just `z`, it might be waiting for a call. We'll allow it, though it's incomplete.
    // In practice, a lone `z` isn't a full schema. But let's be lenient.
    return expr.name === "z";
  }

  if (expr.type === "MemberExpression") {
    return validateZodCallee(expr);
  }

  // Anything else (like arrow functions, binary expressions, etc.) should not be present in a pure schema
  return false;
}

function validateZodCallee(callee: Node): boolean {
  // We need to ensure the callee resolves to something like z.string or z.number().optional()
  // That means a chain of MemberExpressions starting from `z`.
  // Allowed patterns:
  // z.<allowedZodMethod>(...) or
  // (z.<allowedZodMethod>(...)).<allowedChainMethod>(...)

  if (isIdentifier(callee)) {
    // Just `z` by itself is allowed (?), but not a valid final schema.
    return callee.name === "z";
  }

  if (callee.type === "MemberExpression") {
    const { object, property } = callee;
    if (!isIdentifier(property)) return false;

    // The property name must be in either allowedZodMethods or allowedChainMethods
    // Check object recursively
    const propertyName = property.name;
    if (
      !allowedZodMethods.has(propertyName) &&
      !allowedChainMethods.has(propertyName)
    ) {
      return false;
    }

    return validateZodCallee(object);
  }

  if (callee.type === "CallExpression") {
    // If the callee is a call, verify that call too
    return validateZodCallee(callee.callee);
  }

  return false;
}

function transformAST(ast: File) {
  // We will:
  // 1. Remove imports.
  // 2. Remove any statements that are not Zod schema definitions.
  // 3. For variable declarations that are Zod schemas, ensure they are exported.

  traverse(ast, {
    ImportDeclaration(path) {
      // Remove all imports
      path.remove();
    },
    Statement(path) {
      // If it's not a variable declaration defining a Zod schema, remove it.
      // If it's a variable declaration, check each declarator.
      if (path.isVariableDeclaration()) {
        // Filter out any non-zod schema declarators
        const decl = path.node as VariableDeclaration;
        decl.declarations = decl.declarations.filter(
          (d: VariableDeclarator) => {
            if (!d.init) return false;
            return isZodSchemaExpression(d.init);
          }
        );

        // If none left, remove the statement
        if (decl.declarations.length === 0) {
          path.remove();
          return;
        }

        // If declarations remain, ensure each is exported
        // We'll turn `const x = ...;` into `export const x = ...;`
        if (!path.node.declare && !path.node.exportKind) {
          path.node.kind = "const";
          // If already exported at top level via separate export, we can skip.
          // But let's force export here for simplicity:
          if (!path.parentPath.isExportNamedDeclaration()) {
            path.replaceWith({
              type: "ExportNamedDeclaration",
              declaration: path.node,
              specifiers: [],
              source: null,
            });
          }
        }
      } else if (
        !path.isExportNamedDeclaration() &&
        !path.isExportAllDeclaration()
      ) {
        // Remove anything that's not a variable declaration or export
        if (
          !path.isExportNamedDeclaration() &&
          !path.isExportAllDeclaration()
        ) {
          path.remove();
        }
      }
    },
  });
}

async function main() {
  const args = process.argv.slice(2);
  let schemaCode = "";

  const useClipboard = args.includes("--clipboard") || args.includes("-c");
  if (useClipboard) {
    console.log("Reading schema from clipboard...");
    schemaCode = await clipboardy.read();
  } else {
    const fileArg = args.find((a) => !a.startsWith("-"));
    if (!fileArg) {
      console.error(
        "No input specified. Use --clipboard or provide a file path."
      );
      process.exit(1);
    }

    console.log(`Reading schema from ${fileArg}...`);
    schemaCode = fs.readFileSync(path.resolve(fileArg), "utf-8");
  }

  if (!schemaCode.trim()) {
    console.error("Empty schema provided.");
    process.exit(1);
  }

  let ast: File;
  try {
    ast = parse(schemaCode, {
      sourceType: "module",
      plugins: ["typescript"], // parse TS syntax
    });
  } catch (err: any) {
    console.error("Failed to parse code:", err.message);
    process.exit(1);
  }

  // Transform AST
  transformAST(ast);

  const { code } = generate(ast, {
    jsescOption: { minimal: true },
  });

  if (!code.trim()) {
    console.error("No valid Zod schemas found after cleaning.");
    process.exit(1);
  }

  console.log("Transformed code:");
  console.log(code);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
