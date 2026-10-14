import { describe, expect, it } from "vitest";
import { serializeWorkflow, validateWorkflow, type WorkflowDocument } from "../src/core/workflow";
const valid: WorkflowDocument = {
  version: 1, startUrl: "https://example.com", browser: "chrome",
  steps: [{ id: "step-1", name: "Open site", type: "navigate" }]
};
describe("workflow validation", () => {
  it("accepts a valid workflow", () => expect(validateWorkflow(valid).valid).toBe(true));
  it("rejects unsupported schema versions", () => expect(validateWorkflow({...valid, version: 3}).errors).toContain("Workflow version must be 1."));
  it("rejects duplicate step ids", () => {
    const result = validateWorkflow({...valid, steps: [...valid.steps, {...valid.steps[0]}]});
    expect(result.valid).toBe(false);
    expect(result.errors.some(x => x.includes("duplicate id"))).toBe(true);
  });
  it("rejects negative timeouts", () => {
    const result = validateWorkflow({...valid, steps:[{...valid.steps[0], timeout:-1}]});
    expect(result.errors.some(x => x.includes("non-negative"))).toBe(true);
  });
  it("exports valid workflow as readable JSON", () => {
    const output = serializeWorkflow(valid);
    expect(JSON.parse(output)).toEqual(valid);
    expect(output).toContain('"version": 1');
  });
  it("does not export invalid workflows", () => {
    expect(() => serializeWorkflow({...valid, browser:"safari" as "chrome"})).toThrow();
  });
});
