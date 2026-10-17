import { describe, expect, it } from "vitest";
import { createStep, normalizeWorkflow, serializeWorkflow, validateWorkflow, type WorkflowDocument } from "../src/core/workflow";
const valid: WorkflowDocument = {
  version: 1, name: "Test workflow", startUrl: "https://example.com", browser: "chrome",
  steps: [{ id: "step-1", name: "Open site", type: "navigate", url: "https://example.com" }], groups: [], variables: []
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
  it("rejects locator-based actions with an empty locator", () => {
    const result = validateWorkflow({...valid, steps: [{id:"s1",name:"Click",type:"click",target:{strategy:"css",value:""}}]});
    expect(result.valid).toBe(false);
    expect(result.errors.some(x => x.includes("non-empty locator"))).toBe(true);
  });
  it("creates user-input steps and validates every field destination", () => {
    const step = createStep("userInput");
    expect(step.inputs).toHaveLength(1);
    const validStep = { ...step, inputs: [{ id: "email", title: "Email address", required: true, secret: false, target: { strategy: "css" as const, value: "#email" } }] };
    expect(validateWorkflow({ ...valid, steps: [validStep] }).valid).toBe(true);
    expect(validateWorkflow({ ...valid, steps: [{ ...validStep, inputs: [{ ...validStep.inputs[0], target: { strategy: "css" as const, value: "" } }] }] }).errors.some(error => /target locator or a variable name/.test(error))).toBe(true);
  });

  it("supports user input saved directly to a variable without a webpage locator", () => {
    const step = createStep("userInput");
    const result = validateWorkflow({ ...valid, steps: [{ ...step, inputs: [{ id: "choice", title: "Choose action", valueType: "choice", options: ["Continue", "Retry", "Cancel"], variableName: "user_action", target: { strategy: "css", value: "" } }] }] });
    expect(result.valid).toBe(true);
  });
  it("rejects multiple-choice inputs with fewer than two options", () => {
    const step = createStep("userInput");
    const result = validateWorkflow({ ...valid, steps: [{ ...step, inputs: [{ id: "choice", title: "Choose action", valueType: "choice", options: ["Only"], variableName: "user_action", target: { strategy: "css", value: "" } }] }] });
    expect(result.errors.some(error => /between 2 and 100/.test(error))).toBe(true);
  });
  it("requires a referenced workflow id for workflow-call steps", () => {
    const base = { id: "call-1", name: "Run sub-workflow", type: "runWorkflow" as const };
    expect(validateWorkflow({ ...valid, steps: [base] }).errors.some(error => /select a workflow/i.test(error))).toBe(true);
    expect(validateWorkflow({ ...valid, steps: [{ ...base, workflowId: "wf-2" }] }).valid).toBe(true);
  });

  it("rejects invalid variable names and duplicate names", () => {
    const result = validateWorkflow({...valid, variables:[
      {id:"v1",name:"bad-name",value:"x"},
      {id:"v2",name:"bad-name",value:"y"}
    ]});
    expect(result.valid).toBe(false);
    expect(result.errors.some(x => x.includes("Variable 1 name"))).toBe(true);
  });
  it("rejects steps assigned to a missing group", () => {
    const result = validateWorkflow({...valid, steps:[{...valid.steps[0],groupId:"missing"}]});
    expect(result.errors.some(x => x.includes("group that does not exist"))).toBe(true);
  });
  it("normalizes legacy v1 JSON that omitted editor metadata", () => {
    const legacy = normalizeWorkflow({version:1,startUrl:"https://example.com",browser:"chrome",steps:[{id:"s1",name:"Open",type:"navigate",url:"https://example.com"}]});
    expect(legacy.name).toBe("Untitled workflow");
    expect(legacy.groups).toEqual([]);
    expect(legacy.variables).toEqual([]);
  });
  it("rejects non-http start URLs", () => {
    const result = validateWorkflow({...valid, startUrl:"file:///C:/secret.txt"});
    expect(result.errors.some(x => x.includes("http or https"))).toBe(true);
  });
});
