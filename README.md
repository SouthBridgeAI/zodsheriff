# 🛡️ ZodSheriff

<div align="center">

[![npm version](https://img.shields.io/npm/v/zodsheriff.svg)](https://www.npmjs.com/package/zodsheriff)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

**Safe validation and execution of LLM-generated Zod schemas**

Safely run Zod schemas from LLMs while preserving structure, comments, and documentation. Invalid parts are surgically removed while keeping the rest intact.

[Features](#-key-features) • [Quick Start](#-quick-start) • [Usage](#-usage) • [Advanced Features](#-advanced-features) • [Architecture](#️-architecture-decisions)

</div>

## 🎯 Key Features

- **🔒 Safe Schema Execution**: Run Zod schemas from LLMs without worrying about malicious code or infinite loops
- **🛡️ Proactive Security**: Prevents regex DoS attacks and detects unsafe patterns
- **⚡ Resource Protection**: Aggressive timeout management and depth tracking
- **🔍 Deep Validation**: Comprehensive validation of methods, arguments, and properties
- **🎯 Smart Schema Analysis**: Powerful schema unification and transformation capabilities
- **🎚️ Configurable Safety**: Multiple security profiles with deep customization
- **📊 Type-Safe Architecture**: Built with TypeScript, featuring extensive type safety
- **🛠️ CLI & API**: Flexible usage through CLI or programmatic API

## 🚀 Quick Start

### CLI Usage

```bash
# Basic validation
bunx zodsheriff schema.ts

# Read from clipboard
bunx zodsheriff --clipboard

# Read from stdin (great for pipelines)
cat schema.ts | bunx zodsheriff --stdin

# Choose security level
bunx zodsheriff --config medium schema.ts

# Get cleaned schema
bunx zodsheriff --clean-only schema.ts > safe-schema.ts

# Get unified schema (combines dependent schemas)
bunx zodsheriff --getUnifiedLargest schema.ts > unified.ts

# Unwrap top-level arrays in unified schema
bunx zodsheriff --getUnifiedLargest --unwrapArrays schema.ts > unified.ts
```

## 📦 Installation

```bash
npm install zodsheriff   # Using npm
yarn add zodsheriff      # Using yarn
pnpm add zodsheriff     # Using pnpm
```

## 💻 Usage

### API Usage

```typescript
import { validateZodSchema } from "zodsheriff";

// Basic validation
const result = await validateZodSchema(schemaCode);
if (result.isValid) {
  console.log("Schema is safe!");
  console.log(result.cleanedCode);
}

// With schema unification
const result = await validateZodSchema(schemaCode, {
  schemaUnification: {
    enabled: true,
    unwrapArrayRoot: true, // Unwrap top-level arrays
  },
});

// Access unified schemas
if (result.schemaGroups?.length) {
  console.log("Largest unified schema:", result.schemaGroups[0].code);
}
```

### Security Levels

```typescript
import {
  validateZodSchema,
  extremelySafeConfig,
  mediumConfig,
  relaxedConfig,
} from "zodsheriff";

// Extremely Safe - Best for untrusted LLM output
const safeResult = await validateZodSchema(code, extremelySafeConfig);

// Medium - Balanced for semi-trusted sources
const mediumResult = await validateZodSchema(code, mediumConfig);

// Relaxed - For trusted sources
const relaxedResult = await validateZodSchema(code, relaxedConfig);
```

### Custom Configuration

```typescript
import { validateZodSchema, createConfig, relaxedConfig } from "zodsheriff";

const config = createConfig(relaxedConfig, {
  timeoutMs: 2000,
  maxNodeCount: 5000,
  maxChainDepth: 4,
  schemaUnification: {
    enabled: true,
    unwrapArrayRoot: true,
  },
  propertySafety: {
    deniedPrefixes: ["_", "$"],
    deniedProperties: new Set(["constructor", "__proto__"]),
  },
});

const result = await validateZodSchema(schemaCode, config);
```

## 🔍 Advanced Features

### Schema Unification

ZodSheriff can analyze dependencies between schemas and generate unified, self-contained versions:

```typescript
// Input schemas with dependencies
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
});

const userSchema = z.object({
  name: z.string(),
  address: addressSchema,
});

// After unification (--getUnifiedLargest):
const unifiedSchema = z.object({
  name: z.string(),
  address: z.object({
    street: z.string(),
    city: z.string(),
  }),
});
```

### Array Unwrapping

When using schema unification, you can automatically unwrap top-level array schemas:

```typescript
// Input schema
const arraySchema = z.array(
  z.object({
    id: z.string(),
    value: z.number(),
  })
);

// After unification with --unwrapArrays:
const unwrappedSchema = z.object({
  id: z.string(),
  value: z.number(),
});
```

### Validation Results

```typescript
const result = await validateZodSchema(schemaCode);

// Validation status
console.log("Valid:", result.isValid);

// Review issues
result.issues.forEach((issue) => {
  console.log(`${issue.severity}: ${issue.message} at line ${issue.line}`);
  if (issue.suggestion) {
    console.log(`Suggestion: ${issue.suggestion}`);
  }
});

// Access root schemas
console.log("Root schemas:", result.rootSchemaNames);

// Access unified schemas
if (result.schemaGroups?.length) {
  const largest = result.schemaGroups[0];
  console.log(`Unified schema with ${largest.metrics.schemaCount} schemas`);
}
```

## 🏗️ Architecture Decisions

### Safety First

- Strict method and property whitelisting
- Comprehensive function validation
- Protection against prototype pollution
- Resource limits and timeout protection

### Smart Processing

- AST-based schema analysis
- Schema dependency tracking
- Intelligent unification
- Comment and structure preservation

### Performance

- Smart caching strategy
- Optimized validation paths
- Resource-aware processing
- Configurable parallelization

## 📚 Documentation

For detailed documentation, visit:

- [API Documentation](https://github.com/yourusername/zodsheriff/wiki/API)
- [CLI Reference](https://github.com/yourusername/zodsheriff/wiki/CLI)
- [Configuration Guide](https://github.com/yourusername/zodsheriff/wiki/Configuration)
- [Security Guide](https://github.com/yourusername/zodsheriff/wiki/Security)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

MIT License - see [LICENSE](LICENSE) for details
