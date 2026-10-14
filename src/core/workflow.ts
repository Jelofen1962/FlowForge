export type LocatorStrategy = "xpath" | "css" | "id" | "name" | "linkText" | "className" | "tagName";
export type WorkflowStep = {
  id: string;
  name: string;
  type: string;
  target?: { strategy: LocatorStrategy; value: string };
  disabled?: boolean;
  timeout?: number;
  onError?: "stop" | "continue";
  [key: string]: unknown;
};
export type WorkflowDocument = { version: number; startUrl: string; browser: "chrome" | "edge"; steps: WorkflowStep[] };
export function validateWorkflow(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid:false, errors:["Workflow must be an object."] };
  const doc = input as Partial<WorkflowDocument>;
  if (doc.version !== 1) errors.push("Workflow version must be 1.");
  if (typeof doc.startUrl !== "string") errors.push("startUrl must be a string.");
  if (doc.browser !== "chrome" && doc.browser !== "edge") errors.push("browser must be chrome or edge.");
  if (!Array.isArray(doc.steps)) errors.push("steps must be an array.");
  else {
    const ids = new Set<string>();
    doc.steps.forEach((step, index) => {
      if (!step || typeof step !== "object") { errors.push(`Step ${index + 1} must be an object.`); return; }
      if (!step.id || typeof step.id !== "string") errors.push(`Step ${index + 1} needs an id.`);
      else if (ids.has(step.id)) errors.push(`Step ${index + 1} has a duplicate id.`);
      else ids.add(step.id);
      if (!step.name || typeof step.name !== "string") errors.push(`Step ${index + 1} needs a name.`);
      if (!step.type || typeof step.type !== "string") errors.push(`Step ${index + 1} needs a type.`);
      if (step.target && (!step.target.strategy || typeof step.target.value !== "string")) errors.push(`Step ${index + 1} has an invalid target locator.`);
      if (step.timeout !== undefined && (!Number.isFinite(step.timeout) || step.timeout < 0)) errors.push(`Step ${index + 1} timeout must be a non-negative number.`);
    });
  }
  return { valid: errors.length === 0, errors };
}
export function serializeWorkflow(doc: WorkflowDocument): string {
  const result = validateWorkflow(doc);
  if (!result.valid) throw new Error(result.errors.join("\\n"));
  return JSON.stringify(doc, null, 2);
}
