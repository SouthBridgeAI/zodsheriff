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
  CallExpression,
} from "@babel/types";
import { allowedZodMethods, allowedChainMethods } from "./zod-method-names";

interface Issue {
  line: number;
  message: string;
  nodeType: string;
  suggestion?: string;
}

const issues: Issue[] = [];

function isZodSchemaExpression(expr: Expression): boolean {
  return validateZodExpression(expr);
}

function validateZodExpression(expr: Expression): boolean {
  if (isCallExpression(expr)) {
    return validateZodCall(expr);
  }

  if (isIdentifier(expr)) {
    if (expr.name !== "z") {
      reportIssue(
        expr,
        `Unexpected identifier '${expr.name}' in schema.`,
        "Identifier"
      );
      return false;
    }
    return true;
  }

  if (expr.type === "MemberExpression") {
    return validateZodCallee(expr);
  }

  reportIssue(
    expr,
    `Unexpected expression type '${expr.type}' in schema.`,
    expr.type
  );
  return false;
}

function validateZodCall(call: CallExpression): boolean {
  const { callee, arguments: args } = call;

  if (!validateZodCallee(callee)) {
    return false;
  }

  const calledMethod = getCalleePropertyName(callee);
  if (
    calledMethod === "refine" ||
    calledMethod === "superRefine" ||
    calledMethod === "transform"
  ) {
    for (const arg of args) {
      if (
        arg.type === "ArrowFunctionExpression" ||
        arg.type === "FunctionExpression"
      ) {
        if (
          arg.body.type !== "Identifier" &&
          arg.body.type !== "BlockStatement"
        ) {
          reportIssue(
            arg,
            "Refinement functions must be simple. Complex bodies disallowed.",
            arg.type
          );
          return false;
        }
      } else if (isCallExpression(arg) || arg.type === "MemberExpression") {
        if (!validateZodExpression(arg)) return false;
      } else if (
        arg.type !== "Identifier" &&
        arg.type !== "ObjectExpression" &&
        arg.type !== "StringLiteral" &&
        arg.type !== "NumericLiteral" &&
        arg.type !== "BooleanLiteral"
      ) {
        reportIssue(
          arg,
          "Refine/transform arguments must be simple literals, functions, or simple schemas.",
          arg.type
        );
        return false;
      }
    }
  } else {
    for (const arg of args) {
      if (
        isCallExpression(arg) ||
        arg.type === "MemberExpression" ||
        isIdentifier(arg)
      ) {
        if (!validateZodExpression(arg)) return false;
      }
    }
  }

  return true;
}

function validateZodCallee(callee: Node): boolean {
  if (isIdentifier(callee)) {
    if (callee.name !== "z") {
      reportIssue(
        callee,
        `Callee must start with 'z'. Found '${callee.name}'.`,
        "Identifier"
      );
      return false;
    }
    return true;
  }

  if (callee.type === "MemberExpression") {
    const { object, property } = callee;
    if (!isIdentifier(property)) {
      reportIssue(
        property,
        "Callee property must be an identifier.",
        property.type
      );
      return false;
    }

    const propertyName = property.name;
    if (
      !allowedZodMethods.has(propertyName) &&
      !allowedChainMethods.has(propertyName)
    ) {
      reportIssue(
        callee,
        `Disallowed Zod method or chain: ${propertyName}`,
        "MemberExpression",
        "Remove or replace this method with an allowed one."
      );
      return false;
    }

    return validateZodCallee(object);
  }

  if (callee.type === "CallExpression") {
    return validateZodCallee(callee.callee);
  }

  reportIssue(callee, `Invalid callee type '${callee.type}'.`, callee.type);
  return false;
}

function getCalleePropertyName(callee: Node): string | null {
  if (callee.type === "MemberExpression") {
    const prop = callee.property;
    if (isIdentifier(prop)) {
      return prop.name;
    }
  } else if (callee.type === "Identifier") {
    return callee.name;
  } else if (callee.type === "CallExpression") {
    return getCalleePropertyName(callee.callee);
  }
  return null;
}

function transformAST(ast: File) {
  traverse(ast, {
    ImportDeclaration(path) {
      // Remove all imports
      path.remove();
    },
    Statement(path) {
      if (path.isVariableDeclaration()) {
        const decl = path.node as VariableDeclaration;
        decl.declarations = decl.declarations.filter(
          (d: VariableDeclarator) => {
            if (!d.init) return false;
            const valid = isZodSchemaExpression(d.init);
            if (!valid) {
              reportIssue(
                d.init,
                `Variable ${
                  d.id.type === "Identifier" ? d.id.name : "unknown"
                } does not seem to be a valid Zod schema.`,
                d.init.type
              );
            }
            return valid;
          }
        );

        if (decl.declarations.length === 0) {
          path.remove();
          return;
        }

        if (!path.node.declare && !path.node.exportKind) {
          path.node.kind = "const";
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
        path.remove();
      }
    },
  });
}

function reportIssue(
  node: Node,
  message: string,
  nodeType: string,
  suggestion?: string
) {
  const line = node.loc?.start.line ?? -1;
  issues.push({
    line,
    message,
    nodeType,
    suggestion,
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
      // comments are enabled by default, but you can confirm by explicitly setting:
      // (Not needed with latest Babel, just clarifying)
      // comments: true,
    });
  } catch (err: any) {
    console.error("Failed to parse code:", err.message);
    issues.push({
      line: 0,
      message: `Failed to parse code: ${err.message}`,
      nodeType: "File",
    });
    const result = {
      cleanedCode: "",
      issues,
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  transformAST(ast);

  const { code } = generate(ast, {
    comments: true, // Ensure comments are preserved
    jsescOption: { minimal: true },
  });

  if (!code.trim()) {
    issues.push({
      line: 0,
      message: "No valid Zod schemas found after cleaning.",
      nodeType: "File",
      suggestion: "Check that your input contains valid Zod schemas.",
    });
  }

  const result = {
    cleanedCode: code,
    issues,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  issues.push({
    line: 0,
    message: `Unexpected error: ${err.message}`,
    nodeType: "Unknown",
  });
  const result = {
    cleanedCode: "",
    issues,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
});
