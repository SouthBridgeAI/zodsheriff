import type { Issue } from "./reporting";
import { validateSchema } from "./schema-validator";
import { createConfig, relaxedConfig, type ValidationConfig } from "./types";

// Core validators and types
export { SchemaValidator, validateSchema } from "./schema-validator";
export type { ValidationConfig, PropertySafetyConfig } from "./types";
export { IssueReporter, IssueSeverity, type Issue } from "./reporting";
export {
  ResourceManager,
  ValidationError,
  type ResourceStats,
} from "./resource-manager";

// Preset configurations
export {
  extremelySafeConfig,
  mediumConfig,
  relaxedConfig,
  createConfig,
} from "./types";

// Main validation function with default config
export async function validateZodSchema(
  schemaCode: string,
  config: Partial<ValidationConfig> = {},
): Promise<{
  isValid: boolean;
  cleanedCode: string;
  issues: Array<Issue>;
}> {
  const finalConfig = createConfig(relaxedConfig, config);
  return validateSchema(schemaCode, finalConfig);
}

// Example usage in comments
/*
import { validateZodSchema, extremelySafeConfig } from 'zod-validator';

// Using default config (medium)
const result = await validateZodSchema(`
  import { z } from 'zod';
  export const userSchema = z.object({
    name: z.string(),
    age: z.number()
  });
`);

// Using specific config
const resultWithConfig = await validateZodSchema(schemaCode, {
  timeoutMs: 2000,
  maxNodeCount: 5000
});

// Using preset config
const safeResult = await validateZodSchema(schemaCode, extremelySafeConfig);
*/
