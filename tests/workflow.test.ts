import { describe, expect, it } from "vitest";
import { normalizeWorkflow, serializeWorkflow, validateWorkflow, type WorkflowDocument } from "../src/core/workflow";
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
