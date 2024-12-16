import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import generate from "@babel/generator";
import clipboardy from "clipboardy";
import {
  File,
  VariableDeclaration,
  VariableDeclarator,
  Node,
  Expression,
  CallExpression,
  MemberExpression,
  ArrowFunctionExpression,
  FunctionExpression,
  StringLiteral,
  ObjectExpression,
  Identifier,
} from "@babel/types";
import {
  allowedChainMethods,
  allowedZodMethods,
} from "../src/zod-method-names";

const MAX_CHAIN_DEPTH = 5;
const MAX_OBJECT_DEPTH = 5;
const MAX_STRING_LENGTH = 1000;
const MAX_NODE_COUNT = 10000; // Node count limit to prevent DoS
const MAX_ARGUMENT_NESTING = 5; // For refine/transform argument nesting

interface Issue {
  line: number;
  column?: number;
  message: string;
  nodeType: string;
  suggestion?: string;
}

const issues: Issue[] = [];

let nodeCount = 0;

function incrementNodeCount() {
  nodeCount++;
  if (nodeCount > MAX_NODE_COUNT) {
    throw new Error("Too many AST nodes, possible DoS attempt");
  }
}

function isIdentifier(node: Node): node is Identifier {
  return node.type === "Identifier";
}

function isCallExpression(node: Node): node is CallExpression {
  return node.type === "CallExpression";
}

function reportIssue(
  node: Node,
  message: string,
  nodeType: string,
  suggestion?: string
) {
  const line = node.loc?.start.line ?? -1;
  const column = node.loc?.start.column ?? -1; // NEW: column info
  issues.push({
    line,
    column,
    message,
    nodeType,
    suggestion,
  });
}

function validateRefinementBody(
  fn: ArrowFunctionExpression | FunctionExpression
): boolean {
  // Allow loops but no function calls to unknown functions
  // We'll allow: ReturnStatement, IfStatement, ForStatement, WhileStatement, BlockStatement, ExpressionStatement with simple expressions
  // Disallow: CallExpressions inside the body that aren't simple allowed built-ins
  // For simplicity, let's disallow *all* CallExpressions inside the refinement except for `z` schema calls.

  function checkNodeInsideRefinement(node: Node): boolean {
    incrementNodeCount();

    // Allow basic control flow
    if (
      node.type === "ReturnStatement" ||
      node.type === "IfStatement" ||
      node.type === "ForStatement" ||
      node.type === "WhileStatement" ||
      node.type === "BlockStatement" ||
      node.type === "ExpressionStatement" ||
      node.type === "VariableDeclaration" ||
      node.type === "AssignmentExpression" ||
      node.type === "BinaryExpression" ||
      node.type === "LogicalExpression" ||
      node.type === "UnaryExpression" ||
      node.type === "UpdateExpression" ||
      node.type === "Identifier" ||
      node.type === "StringLiteral" ||
      node.type === "NumericLiteral" ||
      node.type === "BooleanLiteral" ||
      node.type === "NullLiteral"
    ) {
      return true;
    }

    if (node.type === "CallExpression") {
      // Disallow calls inside refinement unless we add logic to allow certain built-ins
      reportIssue(
        node,
        "Function calls inside refinement not allowed.",
        "CallExpression"
      );
      return false;
    }

    // Recursively check inside block statements, etc.
    // We'll do a basic traversal for children:
    for (const key in node) {
      const val = (node as any)[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          if (child && typeof child.type === "string") {
            if (!checkNodeInsideRefinement(child)) return false;
          }
        }
      } else if (val && typeof val.type === "string") {
        if (!checkNodeInsideRefinement(val)) return false;
      }
    }
    return true;
  }

  return checkNodeInsideRefinement(fn.body);
}

function validateObjectExpression(
  obj: ObjectExpression,
  depth: number
): boolean {
  incrementNodeCount();

  if (depth > MAX_OBJECT_DEPTH) {
    reportIssue(obj, "Object too deeply nested", "ObjectExpression");
    return false;
  }

  for (const prop of obj.properties) {
    incrementNodeCount();
    if (prop.type === "SpreadElement") {
      reportIssue(obj, "Spread elements not allowed", "ObjectExpression");
      return false;
    }

    if (prop.type === "ObjectMethod") {
      // Disallow object methods
      reportIssue(prop, "Object methods not allowed", "ObjectMethod");
      return false;
    }

    if (prop.type === "ObjectProperty") {
      if (prop.computed) {
        reportIssue(prop, "Computed properties not allowed", "ObjectProperty");
        return false;
      }

      // Validate values
      const value = prop.value;
      if (!validateNodeValue(value, depth + 1)) return false;
    }
  }

  return true;
}

function validateNodeValue(node: Node, depth: number): boolean {
  incrementNodeCount();

  // Check nesting depth
  if (depth > MAX_ARGUMENT_NESTING) {
    reportIssue(node, "Argument too deeply nested", node.type);
    return false;
  }

  // If it's a string literal, check length
  if (node.type === "StringLiteral") {
    if (node.value.length > MAX_STRING_LENGTH) {
      reportIssue(node, "String literal too long", "StringLiteral");
      return false;
    }
    return true;
  }

  // If it's an object expression, recursively validate
  if (node.type === "ObjectExpression") {
    return validateObjectExpression(node, depth);
  }

  // If it's a call expression or member expression, validate as a Zod expression
  if (isCallExpression(node) || node.type === "MemberExpression") {
    return validateZodExpression(node, 0); // 0 chain depth for a fresh start here
  }

  // If it's an identifier, just allow if it's simple (like a parameter)
  if (isIdentifier(node)) {
    return true;
  }

  // Allowed literal types:
  if (
    node.type === "NumericLiteral" ||
    node.type === "BooleanLiteral" ||
    node.type === "NullLiteral" ||
    node.type === "BigIntLiteral" ||
    node.type === "RegExpLiteral"
  ) {
    return true;
  }

  // Arrow or Function expression for refine:
  if (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  ) {
    return validateRefinementBody(node);
  }

  // If none matched, disallow
  reportIssue(node, "Disallowed node type in arguments", node.type);
  return false;
}

function validateZodExpression(expr: Expression, chainDepth: number): boolean {
  incrementNodeCount();

  if (isCallExpression(expr)) {
    return validateZodCall(expr, chainDepth);
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
    if (expr.computed) {
      reportIssue(
        expr,
        "Computed properties are not allowed",
        "MemberExpression"
      );
      return false;
    }
    return validateZodCallee(expr, chainDepth);
  }

  reportIssue(
    expr,
    `Unexpected expression type '${expr.type}' in schema.`,
    expr.type
  );
  return false;
}

function validateZodCall(call: CallExpression, chainDepth: number): boolean {
  incrementNodeCount();

  const { callee, arguments: args } = call;

  if (!validateZodCallee(callee, chainDepth)) {
    return false;
  }

  const calledMethod = getCalleePropertyName(callee);

  // If method is refine/superRefine/transform, arguments must be simple
  if (
    calledMethod === "refine" ||
    calledMethod === "superRefine" ||
    calledMethod === "transform"
  ) {
    for (const arg of args) {
      if (!validateNodeValue(arg, 1)) return false;
    }
  } else {
    // For other methods, arguments can be schemas or simple
    for (const arg of args) {
      if (!validateNodeValue(arg, 1)) return false;
    }
  }

  return true;
}

function validateZodCallee(callee: Node, chainDepth: number): boolean {
  incrementNodeCount();
  if (chainDepth > MAX_CHAIN_DEPTH) {
    reportIssue(callee, "Too many chained calls", callee.type);
    return false;
  }

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
    if (!isIdentifier(callee.property)) {
      reportIssue(
        callee.property,
        "Callee property must be an identifier.",
        callee.property.type
      );
      return false;
    }

    const propertyName = callee.property.name;
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

    return validateZodCallee(callee.object, chainDepth + 1);
  }

  if (callee.type === "CallExpression") {
    return validateZodCallee(callee.callee, chainDepth);
  }

  reportIssue(callee, `Invalid callee type '${callee.type}'.`, callee.type);
  return false;
}

function getCalleePropertyName(callee: Node): string | null {
  incrementNodeCount();
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

function isZodSchemaExpression(expr: Expression): boolean {
  return validateZodExpression(expr, 0);
}

function transformAST(ast: File) {
  traverse(ast, {
    ImportDeclaration(path) {
      // We keep removing imports as requested
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
      plugins: ["typescript"],
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

  let zodImported = false;
  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration" && node.source.value === "zod") {
      const hasZ = node.specifiers.some((spec) => spec.local.name === "z");
      if (hasZ) {
        zodImported = true;
      }
    }
  }

  if (!zodImported) {
    reportIssue(ast.program, "No 'z' import from 'zod' found.", "File");
  }

  try {
    transformAST(ast);
  } catch (err: any) {
    console.error("Unexpected error during transform:", err);
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
  }

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
