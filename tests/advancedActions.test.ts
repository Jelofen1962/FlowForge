import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStep, validateWorkflow, type WorkflowStep } from "../src/core/workflow";
const require = createRequire(import.meta.url);
const runner = require("../engine/runner.cjs") as { validatePayload: (payload: unknown) => { steps: unknown[] }; stepRequiresLocator: (type: string) => boolean; evaluateRuntimeCondition: (condition: unknown, context: unknown) => boolean };

describe("advanced browser actions", () => {
  it("recognizes mouse, extraction, assertion, tab and file actions", () => {
    for (const type of ["hover", "rightClick", "doubleClick", "scrollTo", "extractText", "extractAttribute", "extractValue", "extractTable", "saveImage", "assertExists", "assertCount", "assertAttribute", "switchFrame", "uploadFile"] as const) {
      const step = createStep(type);
      if (type === "extractAttribute" || type === "assertAttribute") step.attribute = "href";
      if (type === "uploadFile") step.filePath = "C:/tmp/input.csv";
      expect(step.type).toBe(type);
    }
  });
  it("validates drag-and-drop destination and bounded control-flow blocks", () => {
    expect(() => runner.validatePayload({ steps: [{ type: "dragDrop", target: { strategy: "css", value: "#source" } }] })).toThrow(/destination locator/i);
    expect(() => runner.validatePayload({ steps: [{ type: "repeat", repeatCount: 1001, loopSteps: [] }] })).toThrow(/1-1000/i);
    expect(runner.validatePayload({ steps: [{ type: "ifElse", condition: { source: "lastText", operator: "contains", expected: "x" }, thenSteps: [], elseSteps: [] }] }).steps).toHaveLength(1);
  });


  it("supports set-variable and bulk selector actions", () => {
    for (const type of ["setVariable", "extractAll", "operateAll"] as const) {
      const step = createStep(type);
      expect(step.type).toBe(type);
    }
    expect(runner.stepRequiresLocator("extractAll")).toBe(true);
    expect(runner.stepRequiresLocator("operateAll")).toBe(true);
    expect(() => runner.validatePayload({ steps: [{ type: "setVariable", outputName: "customerName", text: "Ada" }] })).not.toThrow();
    expect(() => runner.validatePayload({ steps: [{ type: "extractAll", target: { strategy: "css", value: ".product" }, outputName: "products" }] })).not.toThrow();
    expect(() => runner.validatePayload({ steps: [{ type: "operateAll", target: { strategy: "className", value: "product" }, bulkOperation: "click" }] })).not.toThrow();
    expect(() => runner.validatePayload({ steps: [{ type: "setVariable", outputName: "not valid", text: "x" }] })).toThrow(/valid output variable/i);
  });

  it("supports URL-change and true/false action-result conditions", () => {
    const context = { variables: {}, lastText: "", url: "https://example.com/next", urlChanged: true, stepStatus: { "click-1": "success", "click-2": "error", "click-3": "skipped" } };
    expect(runner.evaluateRuntimeCondition({ source: "urlChanged", operator: "equals", expected: "true" }, context)).toBe(true);
    expect(runner.evaluateRuntimeCondition({ source: "urlChanged", operator: "falsy" }, { ...context, urlChanged: false })).toBe(true);
    expect(runner.evaluateRuntimeCondition({ source: "stepStatus", key: "click-1", operator: "truthy" }, context)).toBe(true);
    expect(runner.evaluateRuntimeCondition({ source: "stepStatus", key: "click-2", operator: "truthy" }, context)).toBe(false);
    expect(runner.evaluateRuntimeCondition({ source: "stepStatus", key: "click-2", operator: "equals", expected: "error" }, context)).toBe(true);
    expect(() => runner.validatePayload({ steps: [{ type: "ifElse", condition: { source: "urlChanged", operator: "equals", expected: "true" }, thenSteps: [], elseSteps: [] }] })).not.toThrow();
  });
  it("supports empty locators only for actions that do not target an element", () => {
    expect(runner.stepRequiresLocator("navigate")).toBe(false);
    expect(runner.stepRequiresLocator("saveText")).toBe(false);
    expect(runner.stepRequiresLocator("extractText")).toBe(true);
    const doc = { version: 1 as const, name: "Output test", startUrl: "https://example.com", browser: "chrome" as const, steps: [{ ...createStep("saveText"), text: "hello" } as WorkflowStep], groups: [], variables: [] };
    expect(validateWorkflow(doc).valid).toBe(true);
  });
});


describe("workflow output ZIP archives", () => {
  it("packages text and image artifacts into a valid ZIP container", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowforge-zip-test-"));
    try {
      const source = join(root, "run"); const archive = join(root, "run.zip");
      await mkdir(source, { recursive: true }); await writeFile(join(source, "note.txt"), "hello FlowForge"); await writeFile(join(source, "capture.png"), Buffer.from([137,80,78,71,13,10,26,10]));
      const zip = require("../engine/zip.cjs") as { createZipFromDirectory: (source: string, target: string) => Promise<{ fileCount: number }> };
      const result = await zip.createZipFromDirectory(source, archive); const data = await readFile(archive);
      expect(result.fileCount).toBe(2); expect(data.readUInt32LE(0)).toBe(0x04034b50); expect(data.readUInt32LE(data.length - 22)).toBe(0x06054b50);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
