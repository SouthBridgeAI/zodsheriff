// tests/schema-grouping.test.ts

import { SchemaValidator } from "../src/schema-validator";
import { ValidationResult } from "../src/types";
import { createTestConfig } from "./test-utils";

describe("Schema Unification and Unwrapping z.array(...) at top-level", () => {
  it("should unwrap z.array(z.object(...)) if config.unwrapArrayRoot = true", async () => {
    // 1) We enable unification + array-root unwrapping in the config:
    const config = createTestConfig({
      schemaUnification: {
        enabled: true,
        // This new boolean signals we want to remove top-level z.array calls
        unwrapArrayRoot: true,
      },
    });

    const validator = new SchemaValidator(config);

    // 2) This code has a single schema that is basically `z.array(...)` at the top-level.
    const code = `
      import { z } from 'zod';

      // Because it has "schema" in the name, it is recognized as a 'root schema' variable
      const arrayRootSchema = z.array(
        z.object({
          name: z.string(),
        })
      );
    `;

    // 3) Validate
    const result: ValidationResult = await validator.validateSchema(code);

    // We expect that the validator sees no errors
    expect(result.isValid).toBe(true);

    // 4) We expect at least one schema group
    expect(result.schemaGroups).toBeDefined();
    const groups = result.schemaGroups!;
    expect(groups.length).toBeGreaterThan(0);

    // 5) Find our group that contains "arrayRootSchema"
    const arrGroup = groups.find((g) =>
      g.schemaNames.includes("arrayRootSchema")
    );
    expect(arrGroup).toBeDefined();

    // 6) Confirm the final code "unwraps" z.array(...) => z.object(...)
    //    So it should not have "z.array(" at the top-level:
    const finalCode = arrGroup!.code;
    expect(finalCode).toContain("z.object({");
    expect(finalCode).not.toContain("z.array(");
  });

  it("should preserve z.array(...) if unwrapArrayRoot = false", async () => {
    const config = createTestConfig({
      schemaUnification: {
        enabled: true,
        unwrapArrayRoot: false, // do NOT remove top-level z.array
      },
    });
    const validator = new SchemaValidator(config);

    const code = `
      import { z } from 'zod';

      const arrayRootSchema = z.array(z.object({ x: z.number() }));
    `;

    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(true);

    expect(result.schemaGroups).toBeDefined();
    const arrGroup = result.schemaGroups!.find((g) =>
      g.schemaNames.includes("arrayRootSchema")
    );
    expect(arrGroup).toBeDefined();

    const finalCode = arrGroup!.code;
    // Now we expect the top-level 'z.array(...)' call to remain intact.
    expect(finalCode).toContain("z.array(");
  });
});

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

  it("should handle nested z.array(...) calls correctly", async () => {
    const config = createTestConfig({
      schemaUnification: {
        enabled: true,
        unwrapArrayRoot: true,
      },
    });
    const validator = new SchemaValidator(config);

    const code = `
      import { z } from 'zod';
      const arrayRootSchema = z.array(z.array(z.string()));
    `;

    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(true);

    const group = result.schemaGroups!.find((g) =>
      g.schemaNames.includes("arrayRootSchema")
    );
    expect(group).toBeDefined();

    // Should only unwrap the outermost z.array
    expect(group!.code).toContain("z.array(z.string())");
    expect(group!.code.match(/z\.array/g)?.length).toBe(1);
  });

  it("should handle unwrapping when schema is not actually an array", async () => {
    const config = createTestConfig({
      schemaUnification: {
        enabled: true,
        unwrapArrayRoot: true,
      },
    });
    const validator = new SchemaValidator(config);

    const code = `
      import { z } from 'zod';
      const nonArraySchema = z.object({ field: z.string() });
    `;

    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(true);

    const group = result.schemaGroups!.find((g) =>
      g.schemaNames.includes("nonArraySchema")
    );
    expect(group).toBeDefined();
    // Should be unchanged since it's not an array
    expect(group!.code).toContain("z.object({");
  });
});
