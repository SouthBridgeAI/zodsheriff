import { ResourceManager, ValidationError } from "../src/resource-manager";
import { createTestConfig } from "./test-utils";

describe("ResourceManager", () => {
  let manager: ResourceManager;

  beforeEach(() => {
    const config = createTestConfig({ timeoutMs: 100 });
    manager = new ResourceManager(config);
  });

  it("should increment node count without exceeding", () => {
    for (let i = 0; i < 10; i++) {
      manager.incrementNodeCount();
    }
    const stats = manager.getStats();
    expect(stats.nodeCount).toBe(10);
  });

  it("should throw ValidationError when node count exceeded", () => {
    const config = createTestConfig({ maxNodeCount: 5 });
    manager = new ResourceManager(config);

    expect(() => {
      for (let i = 0; i < 6; i++) {
        manager.incrementNodeCount();
      }
    }).toThrowError(ValidationError);
  });

  it("should throw ValidationError when timeout is exceeded", () => {
    const config = createTestConfig({ timeoutMs: 1 });
    manager = new ResourceManager(config);

    const originalDateNow = Date.now;
    jest.spyOn(Date, "now").mockImplementation(() => originalDateNow() + 2000);

    expect(() => manager.checkTimeout()).toThrowError(ValidationError);
  });

  it("should track depth and throw if exceeded", () => {
    const config = createTestConfig({ maxObjectDepth: 1 });
    manager = new ResourceManager(config);

    // Depth allowed is 1, let's do depth = 2
    expect(() => manager.trackDepth(2, "object")).toThrowError(ValidationError);
  });

  it("should validate size and throw if exceeded", () => {
    expect(() => manager.validateSize(101, 100, "array")).toThrowError(
      ValidationError
    );
  });

  it("should return stats", () => {
    manager.incrementNodeCount();
    const stats = manager.getStats();
    expect(stats.nodeCount).toBeGreaterThan(0);
    expect(stats.executionTime).toBeGreaterThanOrEqual(0);
  });
});

describe("ResourceManager - Edge Cases", () => {
  it("should handle rapid consecutive node increments", () => {
    const manager = new ResourceManager(
      createTestConfig({
        maxNodeCount: 2000, // Increase the limit to allow our test
      })
    );
    const incrementCount = 1000;

    const start = Date.now();
    for (let i = 0; i < incrementCount; i++) {
      manager.incrementNodeCount();
    }
    const duration = Date.now() - start;

    const stats = manager.getStats();
    expect(stats.nodeCount).toBe(incrementCount);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it("should throw when rapidly exceeding node count limit", () => {
    const maxNodes = 100;
    const manager = new ResourceManager(
      createTestConfig({
        maxNodeCount: maxNodes,
      })
    );

    expect(() => {
      for (let i = 0; i <= maxNodes + 1; i++) {
        manager.incrementNodeCount();
      }
    }).toThrow(ValidationError);
  });

  it("should track multiple depth types independently", () => {
    const manager = new ResourceManager(createTestConfig());

    manager.trackDepth(3, "object");
    manager.trackDepth(5, "chain");
    manager.trackDepth(2, "argument");

    const stats = manager.getStats();
    expect(stats.maxDepthReached).toBe(5);
  });
});
