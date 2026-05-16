import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EXAMPLES_DIR = join(__dirname, "../../../../../examples/mcp-workflows");

describe("examples/mcp-workflows", () => {
  const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".workflow.json"));

  it("contains at least 5 example workflows", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    it(`${file} matches torqa.workflow.v1 shape`, () => {
      const raw = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
      const wf = JSON.parse(raw) as Record<string, unknown>;
      expect(wf.format).toBe("torqa.workflow.v1");
      expect(typeof wf.id).toBe("string");
      expect(typeof wf.prompt).toBe("string");
      expect(wf.intent).toBeTruthy();
      expect(Array.isArray(wf.steps)).toBe(true);
      expect((wf.steps as unknown[]).length).toBeGreaterThan(0);
      expect(wf.safety).toBeTruthy();
      expect(wf.graph).toBeTruthy();

      for (const step of wf.steps as Array<Record<string, unknown>>) {
        expect(typeof step.id).toBe("string");
        expect(typeof step.tool).toBe("string");
        expect(typeof step.purpose).toBe("string");
        expect(typeof step.approvalRequired).toBe("boolean");
        expect(["low", "medium", "high"]).toContain(step.risk);
      }
    });
  }
});
