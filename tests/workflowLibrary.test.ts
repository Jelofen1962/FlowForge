import { describe, expect, it } from "vitest";
import { buildWorkflowPackage, importWorkflowPackage, type StoredWorkflow } from "../src/core/workflowLibrary";
import type { WorkflowDocument } from "../src/core/workflow";

const doc = (name: string, steps: WorkflowDocument["steps"] = []): WorkflowDocument => ({
  version: 1, name, startUrl: "https://example.com", browser: "chrome", steps, groups: [], variables: []
});
const entry = (id: string, document: WorkflowDocument): StoredWorkflow => ({ id, document, updatedAt: "2026-01-01T00:00:00.000Z" });

describe("workflow library packages", () => {
  it("exports the root workflow and transitive sub-workflow dependencies", () => {
    const root = entry("root", doc("Root", [{ id: "call-child", name: "Call child", type: "runWorkflow", workflowId: "child" }]));
    const child = entry("child", doc("Child", [{ id: "call-leaf", name: "Call leaf", type: "runWorkflow", workflowId: "leaf" }]));
    const leaf = entry("leaf", doc("Leaf", [{ id: "wait", name: "Pause", type: "wait", ms: 1 }]));
    const pack = buildWorkflowPackage("root", [root, child, leaf]);
    expect(pack.workflows.map(item => item.id).sort()).toEqual(["child", "leaf", "root"]);
    expect(pack.rootWorkflowId).toBe("root");
  });

  it("rejects missing dependencies and cycles during export", () => {
    const root = entry("root", doc("Root", [{ id: "call", name: "Call missing", type: "runWorkflow", workflowId: "missing" }]));
    expect(() => buildWorkflowPackage("root", [root])).toThrow(/dependency.*missing/i);
    const cyclic = entry("root", doc("Cycle", [{ id: "call", name: "Self", type: "runWorkflow", workflowId: "root" }]));
    expect(() => buildWorkflowPackage("root", [cyclic])).toThrow(/cycle/i);
  });

  it("remaps workflow IDs and references when importing a package", () => {
    const pack = {
      format: "flowforge-workflow-package", version: 1, rootWorkflowId: "root",
      workflows: [
        { id: "root", document: doc("Root", [{ id: "call", name: "Call child", type: "runWorkflow", workflowId: "child" }]) },
        { id: "child", document: doc("Child", [{ id: "pause", name: "Pause", type: "wait", ms: 10 }]) }
      ]
    };
    const imported = importWorkflowPackage(pack, "2026-10-15T00:00:00.000Z");
    expect(imported.workflows).toHaveLength(2);
    expect(imported.rootWorkflowId).not.toBe("root");
    const root = imported.workflows.find(item => item.id === imported.rootWorkflowId)!;
    const child = imported.workflows.find(item => item.document.name === "Child")!;
    expect(root.document.steps[0].type).toBe("runWorkflow");
    expect(root.document.steps[0].workflowId).toBe(child.id);
  });


  it("rejects cycles while importing a package", () => {
    const cyclic = { format: "flowforge-workflow-package", version: 1, rootWorkflowId: "a", workflows: [
      { id: "a", document: doc("A", [{ id: "call-b", name: "Call B", type: "runWorkflow", workflowId: "b" }]) },
      { id: "b", document: doc("B", [{ id: "call-a", name: "Call A", type: "runWorkflow", workflowId: "a" }]) }
    ] };
    expect(() => importWorkflowPackage(cyclic)).toThrow(/cycle/i);
  });

  it("rejects packages with dangling references and standalone workflows with sub-workflows", () => {
    const dangling = { format: "flowforge-workflow-package", version: 1, rootWorkflowId: "root", workflows: [
      { id: "root", document: doc("Root", [{ id: "call", name: "Call missing", type: "runWorkflow", workflowId: "missing" }]) }
    ] };
    expect(() => importWorkflowPackage(dangling)).toThrow(/missing packaged workflow/i);
    expect(() => importWorkflowPackage(doc("Standalone", [{ id: "call", name: "Call child", type: "runWorkflow", workflowId: "child" }]))).toThrow(/complete .* package/i);
  });
});
