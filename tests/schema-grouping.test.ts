// tests/schema-grouping.test.ts

import { SchemaValidator } from "../src/schema-validator";
import { createTestConfig } from "./test-utils";

describe("Schema Root Detection and Grouping", () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    const config = createTestConfig();
    validator = new SchemaValidator(config);
  });

  describe("Root Schema Detection", () => {
    it("should detect root level schemas with 'schema' in name", async () => {
      const code = `
        import { z } from 'zod';

        const userSchema = z.object({
          name: z.string(),
          age: z.number()
        });

        const addressSchema = z.object({
          street: z.string(),
          city: z.string()
        });
      `;

      const result = await validator.validateSchema(code);

      expect(result.rootSchemaNames.sort()).toEqual([
        "addressSchema",
        "userSchema",
      ]);
    });

    it("should detect root schemas even without 'schema' in name if they use z", async () => {
      const code = `
        import { z } from 'zod';

        const user = z.object({
          name: z.string()
        });

        const nonSchema = 42;
      `;

      const result = await validator.validateSchema(code);
      expect(result.rootSchemaNames).toEqual(["user"]);
    });

    it("should not include non-schema variables in root schemas", async () => {
      const code = `
        import { z } from 'zod';

        const userSchema = z.object({});
        const notASchema = { something: true };
        const alsoNotSchema = undefined;
      `;

      const result = await validator.validateSchema(code);
      expect(result.rootSchemaNames).toEqual(["userSchema"]);
    });
  });

  describe("Schema Grouping", () => {
    it("should group connected schemas together", async () => {
      const code = `
        import { z } from 'zod';

        const addressSchema = z.object({
          street: z.string(),
          city: z.string()
        });

        const userSchema = z.object({
          name: z.string(),
          address: addressSchema
        });

        // Independent schema with no connections
        const settingsSchema = z.object({
          theme: z.string()
        });
      `;

      const result = await validator.validateSchema(code);

      expect(result.schemaGroups).toBeDefined();
      expect(result.schemaGroups!.length).toBe(2); // Two independent groups

      // Find the larger group (user + address)
      const userGroup = result.schemaGroups!.find((g) =>
        g.schemaNames.includes("userSchema")
      );

      expect(userGroup).toBeDefined();
      expect(userGroup!.schemaNames.sort()).toEqual(
        ["addressSchema", "userSchema"].sort()
      );
      expect(userGroup!.metrics.schemaCount).toBe(2);

      // Check the independent settings schema
      const settingsGroup = result.schemaGroups!.find((g) =>
        g.schemaNames.includes("settingsSchema")
      );

      expect(settingsGroup).toBeDefined();
      expect(settingsGroup!.schemaNames).toEqual(["settingsSchema"]);
      expect(settingsGroup!.metrics.schemaCount).toBe(1);
    });

    it("should sort groups by size when requested", async () => {
      const code = `
        import { z } from 'zod';

        // Small independent schema
        const tagSchema = z.object({
          name: z.string()
        });

        // Larger connected group
        const addressSchema = z.object({
          street: z.string(),
          city: z.string(),
          country: z.string()
        });

        const userSchema = z.object({
          name: z.string(),
          age: z.number(),
          address: addressSchema,
          email: z.string().email()
        });
      `;

      const result = await validator.validateSchema(code);

      expect(result.schemaGroups).toBeDefined();
      expect(result.schemaGroups!.length).toBe(2);

      // First group should be the larger one (user + address)
      expect(result.schemaGroups![0].schemaNames.sort()).toEqual(
        ["addressSchema", "userSchema"].sort()
      );
      expect(result.schemaGroups![0].metrics.schemaCount).toBe(2);

      // Second group should be the smaller one (tag)
      expect(result.schemaGroups![1].schemaNames).toEqual(["tagSchema"]);
    });

    // Update the validation failure test:
    it("should handle validation failure gracefully", async () => {
      const code = `
    import { z } from 'zod';

    // Invalid schema (missing z.)
    const badSchema = object({
      field: string()
    });

    const goodSchema = z.object({
      name: z.string()
    });
  `;

      const result = await validator.validateSchema(code);
      expect(result.isValid).toBe(false);
      expect(result.schemaGroups).toBeUndefined();
    });
  });
});
