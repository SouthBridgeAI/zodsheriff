import {
  Node,
  ObjectExpression,
  ObjectProperty,
  ObjectMethod,
  Identifier,
  StringLiteral,
} from "@babel/types";
import { ValidationConfig } from "./types";
import { Issue, IssueSeverity } from "./reporting";

/**
 * Result of validating a node, including any issues found
 */
interface ValidationResult {
  isValid: boolean;
  issues: Issue[];
}

/**
 * Cache for validation results to avoid re-processing nodes
 * Uses WeakMap to allow garbage collection of processed nodes
 */
const validationCache = new WeakMap<Node, ValidationResult>();

/**
 * Validates an object expression against configured safety rules
 * Checks property count, depth, and property name safety
 *
 * @param obj - The object expression node to validate
 * @param depth - Current depth in the object hierarchy
 * @param config - Validation configuration settings
 * @param parentNodes - Stack of parent nodes for context
 * @returns ValidationResult indicating if the object is valid
 */
export function validateObjectExpression(
  obj: ObjectExpression,
  depth: number,
  config: ValidationConfig,
  parentNodes: Node[] = []
): ValidationResult {
  // Check cache first
  const cached = validationCache.get(obj);
  if (config.enableCaching && cached) {
    return cached;
  }

  const issues: Issue[] = [];

  // Check depth
  if (depth > config.maxObjectDepth) {
    issues.push({
      line: obj.loc?.start.line ?? -1,
      column: obj.loc?.start.column,
      message: `Object exceeds maximum nesting depth of ${config.maxObjectDepth}`,
      severity: IssueSeverity.ERROR,
      nodeType: "ObjectExpression",
    });
    return cacheAndReturn(obj, config, { isValid: false, issues });
  }

  // Check property count
  if (obj.properties.length > config.maxPropertiesPerObject) {
    issues.push({
      line: obj.loc?.start.line ?? -1,
      column: obj.loc?.start.column,
      message: `Object exceeds maximum property count of ${config.maxPropertiesPerObject}`,
      severity: IssueSeverity.ERROR,
      nodeType: "ObjectExpression",
    });
    return cacheAndReturn(obj, config, { isValid: false, issues });
  }

  // Validate each property
  for (const prop of obj.properties) {
    if (prop.type === "SpreadElement") {
      issues.push({
        line: prop.loc?.start.line ?? -1,
        column: prop.loc?.start.column,
        message: "Spread elements are not allowed in objects",
        severity: IssueSeverity.ERROR,
        nodeType: "SpreadElement",
      });
      return cacheAndReturn(obj, config, { isValid: false, issues });
    }

    if (isObjectProperty(prop) || isObjectMethod(prop)) {
      const propResult = validateProperty(prop, config, [...parentNodes, obj]);
      if (!propResult.isValid) {
        issues.push(...propResult.issues);
        return cacheAndReturn(obj, config, { isValid: false, issues });
      }
    }
  }

  return cacheAndReturn(obj, config, { isValid: true, issues });
}

/**
 * Validates a single object property or method
 * Checks for unsafe property names, getters/setters, and computed properties
 *
 * @param prop - The property node to validate
 * @param config - Validation configuration settings
 * @param parentNodes - Stack of parent nodes for context
 * @returns ValidationResult indicating if the property is valid
 */
function validateProperty(
  prop: ObjectProperty | ObjectMethod,
  config: ValidationConfig,
  parentNodes: Node[]
): ValidationResult {
  const issues: Issue[] = [];

  // Check for computed properties
  if (prop.computed && !config.allowComputedProperties) {
    issues.push({
      line: prop.loc?.start.line ?? -1,
      column: prop.loc?.start.column,
      message: "Computed properties are not allowed",
      severity: IssueSeverity.ERROR,
      nodeType: prop.type,
    });
    return { isValid: false, issues };
  }

  // Check for getters/setters
  if (isObjectMethod(prop) && (prop.kind === "get" || prop.kind === "set")) {
    issues.push({
      line: prop.loc?.start.line ?? -1,
      column: prop.loc?.start.column,
      message: "Getter/setter methods are not allowed",
      severity: IssueSeverity.ERROR,
      nodeType: "ObjectMethod",
    });
    return { isValid: false, issues };
  }

  // Validate property name
  const nameResult = validatePropertyName(prop.key, config);
  if (!nameResult.isValid) {
    issues.push(...nameResult.issues);
    return { isValid: false, issues };
  }

  return { isValid: true, issues };
}

/**
 * Validates a property name against safety rules
 * Checks against allowed/denied lists and prefixes
 *
 * @param key - The property key node to validate
 * @param config - Validation configuration settings
 * @returns ValidationResult indicating if the property name is safe
 */
function validatePropertyName(
  key: Node,
  config: ValidationConfig
): ValidationResult {
  // Only handle identifier and string literal keys
  if (!isIdentifier(key) && !isStringLiteral(key)) {
    return {
      isValid: false,
      issues: [
        {
          line: key.loc?.start.line ?? -1,
          column: key.loc?.start.column,
          message: "Property key must be an identifier or string literal",
          severity: IssueSeverity.ERROR,
          nodeType: key.type,
        },
      ],
    };
  }

  const name = isIdentifier(key) ? key.name : key.value;
  const { propertySafety } = config;

  // Check against denied properties
  if (propertySafety.deniedProperties.has(name)) {
    return {
      isValid: false,
      issues: [
        {
          line: key.loc?.start.line ?? -1,
          column: key.loc?.start.column,
          message: `Property name '${name}' is not allowed`,
          severity: IssueSeverity.WARNING,
          nodeType: key.type,
        },
      ],
    };
  }

  // Check against denied prefixes
  if (propertySafety.deniedPrefixes.some((prefix) => name.startsWith(prefix))) {
    return {
      isValid: false,
      issues: [
        {
          line: key.loc?.start.line ?? -1,
          column: key.loc?.start.column,
          message: `Property name '${name}' uses a forbidden prefix`,
          severity: IssueSeverity.ERROR,
          nodeType: key.type,
        },
      ],
    };
  }

  // If we're using a whitelist, check against allowed properties
  if (
    propertySafety.allowedProperties.size > 0 &&
    !propertySafety.allowedProperties.has(name)
  ) {
    return {
      isValid: false,
      issues: [
        {
          line: key.loc?.start.line ?? -1,
          column: key.loc?.start.column,
          message: `Property name '${name}' is not in the allowed list`,
          severity: IssueSeverity.ERROR,
          nodeType: key.type,
        },
      ],
    };
  }

  return { isValid: true, issues: [] };
}

/**
 * Type guards for node types
 */
function isObjectProperty(node: Node): node is ObjectProperty {
  return node.type === "ObjectProperty";
}

function isObjectMethod(node: Node): node is ObjectMethod {
  return node.type === "ObjectMethod";
}

function isIdentifier(node: Node): node is Identifier {
  return node.type === "Identifier";
}

function isStringLiteral(node: Node): node is StringLiteral {
  return node.type === "StringLiteral";
}

/**
 * Helper to cache and return validation results
 */
function cacheAndReturn(
  obj: ObjectExpression, // Add obj parameter
  config: ValidationConfig, // Add config parameter
  result: ValidationResult
): ValidationResult {
  if (config.enableCaching) {
    validationCache.set(obj, result);
  }
  return result;
}
