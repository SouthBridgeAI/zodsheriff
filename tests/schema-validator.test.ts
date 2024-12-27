import { SchemaValidator } from "../src/schema-validator";
import {
  TestResourceManager,
  createTestConfig,
  createSchemaInput,
  expectValidationIssues,
  testSchemas,
} from "./test-utils";
import { IssueReporter } from "../src/reporting";

describe("SchemaValidator", () => {
  let resourceManager: TestResourceManager;
  let issueReporter: IssueReporter;
  let validator: SchemaValidator;

  beforeEach(() => {
    const config = createTestConfig();
    resourceManager = new TestResourceManager(config);
    issueReporter = new IssueReporter();
    validator = new SchemaValidator(config, resourceManager, issueReporter);
  });

  it("should validate a simple schema", async () => {
    const result = await validator.validateSchema(
      createSchemaInput(testSchemas.basic)
    );
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("should handle schemas missing z import", async () => {
    const code = `export const testSchema = z.object({});`;
    // Missing import statement
    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain("Missing 'z' import from 'zod'");
  });

  it("should remove invalid imports and report issues", async () => {
    const code = `
      import { something } from 'somewhere';
      import { z } from 'zod';
      export const testSchema = z.string();
    `;
    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Only 'zod' imports are allowed"
    );
  });

  it("should reject variable declarations not using const", async () => {
    const code = `
      import { z } from 'zod';
      var testSchema = z.string();
    `;
    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Schema declarations must use 'const'"
    );
  });

  it("should reject schema declaration without initializer", async () => {
    const code = `
      import { z } from 'zod';
      const testSchema = undefined;
    `;
    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(false);
    expect(result.issues[0].message).toContain(
      "Schema declaration must have an initializer"
    );
  });

  it("should reject invalid statements", async () => {
    const code = `
      import { z } from 'zod';
      function notAllowed() {}
      const testSchema = z.string();
    `;
    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(false);
    expect(
      result.issues.some((issue) =>
        issue.message.includes("Invalid statement type")
      )
    ).toBe(true);
  });

  it("should fail when node count exceeds limit", async () => {
    resourceManager.setMockNodeCount(1000);
    const result = await validator.validateSchema(
      createSchemaInput(testSchemas.complex)
    );
    expect(result.isValid).toBe(false);
    expectValidationIssues(result.issues, [{ message: "Node count exceeded" }]);
  });

  it("should fail on timeout", async () => {
    resourceManager.triggerTimeout();
    const result = await validator.validateSchema(
      createSchemaInput(testSchemas.basic)
    );
    expect(result.isValid).toBe(false);
    expectValidationIssues(result.issues, [{ message: "Timeout triggered" }]);
  });

  it("should generate cleaned code if valid", async () => {
    const code = `
      import { z } from 'zod';
      const userSchema = z.object({ name: z.string() });
    `;
    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(true);
    expect(result.cleanedCode).toContain("z.object({");
    expect(result.cleanedCode).toContain("name: z.string()");
  });

  it("should preserve schema descriptions and comments", async () => {
    const code = `
      import { z } from 'zod';

      // Global user type
      const userSchema = z.object({
        /** User's unique identifier */
        id: z.string().uuid().describe('The user UUID'),
        // Basic info
        name: z.string().min(2).describe('User display name'),
      });
    `;

    const result = await validator.validateSchema(code);
    expect(result.isValid).toBe(true);
    expect(result.cleanedCode).toContain("// Global user type");
    expect(result.cleanedCode).toContain("/** User's unique identifier */");
    expect(result.cleanedCode).toContain(".describe('The user UUID')");
    expect(result.cleanedCode).toContain("// Basic info");
  });
});
