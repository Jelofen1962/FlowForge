import { createId, normalizeWorkflow, type WorkflowDocument, type WorkflowStep } from "./workflow";

export interface StoredWorkflow {
  id: string;
  document: WorkflowDocument;
  updatedAt: string;
  aiTag?: boolean;
  aiProvenance?: "generated" | "human-guided" | "ai-assisted";
}

export interface WorkflowPackage {
  format: "flowforge-workflow-package";
  version: 1;
  rootWorkflowId: string;
  workflows: Array<{ id: string; document: WorkflowDocument }>;
}

/** Build a portable package containing a workflow and every transitive sub-workflow it calls. */
export function buildWorkflowPackage(
  rootId: string,
  workflows: StoredWorkflow[],
  current?: { id: string; document: WorkflowDocument }
): WorkflowPackage {
  const byId = new Map<string, StoredWorkflow>(workflows.map(item => [item.id, item]));
  if (current) byId.set(current.id, { ...current, updatedAt: new Date().toISOString() });
  const included = new Map<string, StoredWorkflow>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (included.has(id)) return;
    const item = byId.get(id);
    if (!item) throw new Error(`Workflow dependency "${id}" is missing from the local library.`);
    if (visiting.has(id)) throw new Error(`Workflow dependency cycle detected at "${item.document.name}".`);
    visiting.add(id);
    for (const step of item.document.steps as WorkflowStep[]) {
      if (step.type === "runWorkflow") {
        if (!step.workflowId?.trim()) throw new Error(`Step "${step.name}" must select a workflow to run.`);
        visit(step.workflowId);
      }
    }
    visiting.delete(id);
    included.set(id, item);
  };
  visit(rootId);
  return {
    format: "flowforge-workflow-package",
    version: 1,
    rootWorkflowId: rootId,
    workflows: [...included.values()].map(item => ({ id: item.id, document: item.document }))
  };
}

/** Validate a shared JSON file and remap its internal IDs so it can coexist with local workflows. */
export function importWorkflowPackage(input: unknown, now = new Date().toISOString()): { workflows: StoredWorkflow[]; rootWorkflowId: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Workflow JSON must contain an object.");
  const raw = input as Record<string, unknown>;
  if (raw.format !== "flowforge-workflow-package") {
    const document = normalizeWorkflow(raw);
    if (document.steps.some(step => step.type === "runWorkflow")) {
      throw new Error("This workflow calls another workflow. Import the complete .flowforge.json package exported by FlowForge so dependencies are included.");
    }
    const id = createId();
    return { workflows: [{ id, document, updatedAt: now }], rootWorkflowId: id };
  }
  if (raw.version !== 1 || !Array.isArray(raw.workflows) || raw.workflows.length < 1 || raw.workflows.length > 500) {
    throw new Error("Unsupported or malformed FlowForge workflow package.");
  }
  const rawWorkflows = raw.workflows as Array<{ id?: unknown; document?: unknown }>;
  const idMap = new Map<string, string>();
  for (const item of rawWorkflows) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) throw new Error("Package workflow is missing an id.");
    if (idMap.has(item.id)) throw new Error(`Package contains duplicate workflow id "${item.id}".`);
    idMap.set(item.id, createId());
  }
  if (typeof raw.rootWorkflowId !== "string" || !idMap.has(raw.rootWorkflowId)) throw new Error("Package root workflow was not found in its workflow list.");
  const normalized = rawWorkflows.map(item => ({ oldId: item.id as string, document: normalizeWorkflow(item.document) }));
  for (const item of normalized) {
    for (const step of item.document.steps) {
      if (step.type === "runWorkflow" && (!step.workflowId || !idMap.has(step.workflowId))) {
        throw new Error(`Workflow "${item.document.name}" references a missing packaged workflow "${step.workflowId || ""}".`);
      }
    }
  }
  const normalizedById = new Map(normalized.map(item => [item.oldId, item.document] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const checkAcyclic = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Workflow package contains a sub-workflow cycle at "${normalizedById.get(id)?.name || id}".`);
    visiting.add(id);
    const document = normalizedById.get(id);
    for (const step of document?.steps || []) if (step.type === "runWorkflow" && step.workflowId) checkAcyclic(step.workflowId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const item of normalized) checkAcyclic(item.oldId);
  const workflows = normalized.map(item => ({
    id: idMap.get(item.oldId)!,
    document: {
      ...item.document,
      steps: item.document.steps.map(step => step.type === "runWorkflow"
        ? { ...step, workflowId: idMap.get(step.workflowId!)! }
        : step)
    },
    updatedAt: now
  }));
  return { workflows, rootWorkflowId: idMap.get(raw.rootWorkflowId)! };
}
