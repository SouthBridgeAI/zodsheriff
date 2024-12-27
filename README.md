# 🛡️ ZodSheriff

<div align="center">

[![npm version](https://img.shields.io/npm/v/zodsheriff.svg)](https://www.npmjs.com/package/zodsheriff)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

**Safe validation and execution of LLM-generated Zod schemas**

Safely run LLM-generated schemas while keeping their original structure, comments, and documentation. Invalid parts are surgically removed while preserving the rest.

[Features](#-key-features) • [Quick Start](#-quick-start) • [Usage](#-usage) • [Architecture](#-architecture-decisions) • [Roadmap](#-future-work)

</div>

## 🎯 Key Features

- **🔒 Safe Schema Execution**: Run Zod schemas from LLMs without worrying about malicious code or infinite loops. Invalid paths are surgically removed while keeping the rest intact.
- **🛡️ Proactive Security**: Prevents regex DoS attacks, detects unsafe function patterns, and maintains strict method whitelisting
- **⚡ Resource Protection**: Aggressive timeout management and depth tracking across objects, chains, and arguments
- **🔍 Deep Validation**: Comprehensive checks including function arguments, property names, and schema patterns
- **🎯 Smart Schema Detection**: Identifies and validates schemas even without explicit naming conventions
- **🎚️ Configurable Safety**: Multiple pre-built security profiles with deep customization options
- **📊 Type-Safe Architecture**: Built with TypeScript, featuring extensive type guards and discriminated unions
- **🛠️ CLI & API**: Use directly in your code or through the command line interface with rich error reporting

## 📋 Table of Contents

- [🛡️ ZodSheriff](#️-zodsheriff)
  - [🎯 Key Features](#-key-features)
  - [📋 Table of Contents](#-table-of-contents)
  - [🚀 Quick Start](#-quick-start)
    - [CLI Usage](#cli-usage)
  - [📦 Installation](#-installation)
    - [API Usage](#api-usage)
  - [💻 Usage](#-usage)
    - [Configuration Levels](#configuration-levels)
    - [Custom Configuration](#custom-configuration)
  - [🔍 Advanced Features](#-advanced-features)
    - [Safety Rules](#safety-rules)
    - [Performance Options](#performance-options)
    - [Validation Results](#validation-results)
  - [🏗️ Architecture Decisions](#️-architecture-decisions)
    - [Safety Boundaries](#safety-boundaries)
    - [Performance vs Safety](#performance-vs-safety)
    - [Design Philosophy](#design-philosophy)
  - [🎯 Design Details](#-design-details)
    - [Schema Intelligence](#schema-intelligence)
    - [Safety First](#safety-first)
    - [Smart Processing](#smart-processing)
    - [Safety Mechanisms](#safety-mechanisms)
    - [Performance Considerations](#performance-considerations)
    - [Error Handling](#error-handling)

## 🚀 Quick Start

### CLI Usage

```bash
# Validate a schema file
bunx zodsheriff schema.ts

# Read from clipboard (great for quick validations)
bunx zodsheriff --clipboard

# Read from stdin (perfect for piping)
cat schema.ts | bunx zodsheriff --stdin

# Use specific security level
bunx zodsheriff schema.ts --config medium

# Get cleaned, safe version
bunx zodsheriff schema.ts --clean-only > safe-schema.ts

# Pipe from another command
your-llm-command | bunx zodsheriff --stdin --config extremely-safe > safe-schema.ts
```

## 📦 Installation

```bash
# Using npm
npm install zodsheriff

# Using yarn
yarn add zodsheriff

# Using pnpm
pnpm add zodsheriff
```

The CLI is designed to be pipe-friendly and integrates well with your existing workflow, whether you're copying schemas from elsewhere (--clipboard) or processing them in a command pipeline (--stdin).

### API Usage

```typescript
import { validateZodSchema } from "zodsheriff";

const schemaCode = `
  import { z } from 'zod';
  export const userSchema = z.object({
    name: z.string(),
    age: z.number()
  });
`;

const result = await validateZodSchema(schemaCode);
if (result.isValid) {
  console.log("Schema is safe to use!");
  console.log(result.cleanedCode);
} else {
  console.log("Validation issues:", result.issues);
}
```

## 💻 Usage

### Configuration Levels

ZodSheriff provides three pre-configured security levels:

```typescript
import {
  validateZodSchema,
  extremelySafeConfig,
  mediumConfig,
  relaxedConfig,
} from "zodsheriff";

// Extremely Safe - Best for untrusted LLM output
const safeResult = await validateZodSchema(schemaCode, extremelySafeConfig);

// Medium - Balanced safety for semi-trusted sources
const mediumResult = await validateZodSchema(schemaCode, mediumConfig);

// Relaxed - For trusted sources where convenience is priority
const relaxedResult = await validateZodSchema(schemaCode, relaxedConfig);
```

### Custom Configuration

Customize validation rules for your specific needs:

```typescript
import { validateZodSchema, createConfig, relaxedConfig } from "zodsheriff";

const customConfig = createConfig(relaxedConfig, {
  timeoutMs: 2000,
  maxNodeCount: 5000,
  maxChainDepth: 4,
  propertySafety: {
    deniedPrefixes: ["_", "$"],
    deniedProperties: new Set(["constructor", "__proto__"]),
  },
});

const result = await validateZodSchema(schemaCode, customConfig);
```

## 🔍 Advanced Features

### Safety Rules

ZodSheriff implements multiple layers of protection:

- **Method Chain Validation**: Prevents unsafe method chaining
- **Argument Validation**: Checks function arguments for safety
- **Object Structure Validation**: Prevents prototype pollution
- **Resource Limits**: Protects against infinite loops and excessive computation
- **Property Safety**: Controls allowed property names and access patterns

### Performance Options

Fine-tune performance and resource usage:

```typescript
const config = createConfig(mediumConfig, {
  enableCaching: true,
  enableParallelProcessing: true,
  maxConcurrentValidations: 4,
  timeoutMs: 5000,
});
```

### Validation Results

Get detailed feedback about validation issues:

```typescript
const result = await validateZodSchema(schemaCode);

// Check validation status
console.log("Is Valid:", result.isValid);

// Review any issues
result.issues.forEach((issue) => {
  console.log(`${issue.severity}: ${issue.message} at line ${issue.line}`);
  if (issue.suggestion) {
    console.log(`Suggestion: ${issue.suggestion}`);
  }
});

// Get cleaned code
console.log(result.cleanedCode);
```

## 🏗️ Architecture Decisions

ZodSheriff makes several key architectural decisions to balance safety and usability:

### Safety Boundaries

- **Allowed Methods**: Only verified Zod methods are allowed
- **Function Safety**: Async functions and generators are blocked
- **Property Access**: Strict controls on property names and prototype access
- **Resource Limits**: Hard limits on computation resources

### Performance vs Safety

- **Caching Strategy**: Validation results are cached when safe
- **Parallel Processing**: Optional parallel validation for performance
- **Resource Management**: Smart tracking of node count and execution time

### Design Philosophy

1. **Default to Safety**: All features start locked down and must be explicitly enabled
2. **Clarity Over Convenience**: Validation failures provide clear feedback
3. **Progressive Enhancement**: Security levels allow gradual relaxation of constraints
4. **Resource Awareness**: All operations consider DoS protection

## 🎯 Design Details

ZodSheriff takes a unique approach to schema validation that preserves as much of the original schema as possible while ensuring safety:

### Schema Intelligence

- **Smart Detection**: Identifies schemas based on initialization patterns, not just naming
- **Comment Preservation**: All comments and documentation in the original schema are kept intact
- **Structure Maintenance**: The overall structure of the schema is preserved even when parts are removed
- **Export Normalization**: All valid schemas are automatically exported as constants for consistency
- **Type Information**: TypeScript types and type annotations are preserved
- **Pattern Recognition**: Handles complex nested objects and sparse array elements

### Safety First

Instead of failing entirely on invalid schemas, ZodSheriff:

1. Identifies problematic sections
2. Removes only the invalid parts
3. Keeps all valid schema definitions
4. Maintains the file's overall structure

Example:

```typescript
// Original Schema with Issues
import { z } from "zod";
let unsafeSchema = z.string(); // Using let (unsafe)
const goodSchema = z.number(); // This is fine
eval("malicious code"); // Dangerous

// After ZodSheriff
import { z } from "zod";
export const goodSchema = z.number(); // Preserved and exported
```

### Smart Processing

- **AST-Based Analysis**: Uses Babel's parser for accurate code understanding
- **Contextual Validation**: Validates methods based on their chain context
- **Resource Tracking**: Monitors execution resources per validation
- **Optimistic Parsing**: Tries to salvage as much valid code as possible

### Safety Mechanisms

1. **Import Control**

   - Only allows `import { z } from 'zod'`
   - Removes other imports
   - Preserves type imports

2. **Declaration Safety**

   - Converts valid schemas to exported constants
   - Removes variable declarations using `let` or `var`
   - Prevents async functions and generators in refinements
   - Preserves type declarations and interfaces

3. **Method Chain Validation**

   - Validates entire method chains
   - Uses strict whitelist-based method validation
   - Ensures proper method ordering
   - Prevents infinite loops in refinements

4. **Function Validation**

   - Specialized validation for refine/transform functions
   - Detects and blocks unsafe function patterns
   - Prevents async/generator functions in schemas
   - Validates function argument safety

5. **Object Safety**

   - Prevents prototype pollution
   - Validates object property names with prefix checking
   - Detects and handles getter/setter methods
   - Maintains object structure while removing unsafe parts

6. **Expression Safety**

   - Blocks dangerous expressions (eval, Function constructor)
   - Uses safe-regex to prevent regex DoS attacks
   - Checks computed properties
   - Ensures safe string literals

7. **Resource Protection**
   - Aggressive timeout checking at 90% threshold
   - Periodic validation check every 100ms
   - Separate depth tracking for objects, chains, and arguments
   - Smart instance pooling for validators

### Performance Considerations

- **Caching Strategy**

  - Caches validation results for repeated patterns
  - Shares cache across related validations
  - Clears cache when memory threshold reached

- **Resource Management**
  - Tracks node count during traversal
  - Implements timeouts for long-running validations
  - Controls maximum object depth
  - Manages memory usage for large schemas

### Error Handling

- **Granular Error Reporting**

  - Reports line numbers for issues
  - Suggests fixes where possible
  - Categorizes errors by severity
  - Provides context for each error

- **Partial Success**
  - Returns partially valid schemas
  - Marks removed sections in output
  - Maintains schema functionality
  - Preserves type safety
