export const allowedZodMethods = new Set([
  // Primitives
  "string",
  "number",
  "boolean",
  "date",
  "bigint",
  "symbol",

  // Empty types
  "undefined",
  "null",
  "void",

  // Catch-all types
  "any",
  "unknown",
  "never",

  // Complex types
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
  "promise",

  // Special types
  "enum",
  "nativeEnum",
  "literal",
  "lazy",

  // Coercion
  "coerce",

  // Effects
  "optional",
  "nullable",
  "nullish",
  "transform",
  "default",
  "catch",
  "preprocess",

  // Custom
  "custom",

  // Type helpers
  "instanceof",
]);

export const allowedChainMethods = new Set([
  // String specific validations
  "min",
  "max",
  "length",
  "email",
  "url",
  "emoji",
  "uuid",
  "cuid",
  "cuid2",
  "ulid",
  "regex",
  "includes",
  "startsWith",
  "endsWith",
  "datetime",
  "ip",
  "cidr",
  "trim",
  "toLowerCase",
  "toUpperCase",
  "date",
  "time",
  "duration",
  "base64",
  "nanoid",

  // Number specific validations
  "gt",
  "gte",
  "lt",
  "lte",
  "int",
  "positive",
  "negative",
  "nonpositive",
  "nonnegative",
  "multipleOf",
  "finite",
  "safe",

  // Array/Set methods
  "nonempty",
  "size",
  "element",

  // Effects and transforms
  "optional",
  "nullable",
  "nullish",
  "transform",
  "default",
  "catch",
  "preprocess",
  "refine",
  "superRefine",
  "pipe",
  "brand",
  "readonly",

  // Object methods
  "partial",
  "deepPartial",
  "required",
  "passthrough",
  "strict",
  "strip",
  "catchall",
  "pick",
  "omit",
  "extend",
  "merge",
  "keyof",
  "shape",

  // Common operations
  "describe",
  "or",
  "and",

  // Type conversions
  "array",
  "promise",
]);
