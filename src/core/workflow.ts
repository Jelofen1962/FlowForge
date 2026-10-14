export const WORKFLOW_VERSION = 1 as const;

export type LocatorStrategy =
  | "xpath" | "css" | "id" | "name" | "linkText" | "className" | "tagName";

export type StepType =
  | "click" | "type" | "key" | "navigate"
  | "waitVisible" | "waitClickable" | "wait" | "assertText"
  | "select" | "screenshot" | "back" | "forward" | "refresh";

export type OnErrorPolicy = "stop" | "continue";

export interface Locator {
  strategy: LocatorStrategy;
  value: string;
}


export interface StepCondition {
  source: "variable" | "lastText" | "url" | "stepStatus";
  key?: string;
  operator: "equals" | "notEquals" | "contains" | "notContains" | "matches" | "greaterThan" | "lessThan" | "truthy" | "falsy";
  expected?: string;
}

export interface StepRetry {
  attempts: number;
  delayMs: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  target?: Locator;
  url?: string;
  text?: string;
  key?: string;
  ms?: number;
  timeout?: number;
  expected?: string;
  disabled?: boolean;
  onError?: OnErrorPolicy;
  clearFirst?: boolean;
  groupId?: string;
  condition?: StepCondition;
  retry?: StepRetry;
  loop?: { mode: "count" | "while"; count?: number; condition?: StepCondition; maxIterations?: number };
}

export interface WorkflowGroup {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  value: string;
  secret?: boolean;
}

export interface WorkflowDocument {
  version: typeof WORKFLOW_VERSION;
  name: string;
  startUrl: string;
  browser: "chrome" | "edge";
  steps: WorkflowStep[];
  groups: WorkflowGroup[];
  variables: WorkflowVariable[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const locatorStrategies: LocatorStrategy[] = [
  "xpath", "css", "id", "name", "linkText", "className", "tagName"
];
const stepTypes: StepType[] = [
  "click", "type", "key", "navigate", "waitVisible", "waitClickable",
  "wait", "assertText", "select", "screenshot", "back", "forward", "refresh"
];
const requiredLocatorTypes = new Set<StepType>([
  "click", "type", "waitVisible", "waitClickable", "assertText", "select"
]);

export function createId(): string {
  // crypto.randomUUID is supported by current Electron/Chromium; fallback keeps imports/test runners portable.
  return globalThis.crypto?.randomUUID?.()
    ?? `ff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createStep(type: StepType = "click", groupId?: string): WorkflowStep {
  const labels: Record<StepType, string> = {
    click: "Click element",
    type: "Type text",
    key: "Keyboard shortcut",
    navigate: "Navigate to URL",
    waitVisible: "Wait until visible",
    waitClickable: "Wait until clickable",
    wait: "Wait / pause",
    assertText: "Assert text",
    select: "Select option",
    screenshot: "Take screenshot",
    back: "Go back",
    forward: "Go forward",
    refresh: "Refresh page"
  };
  return {
    id: createId(),
    name: labels[type],
    type,
    target: requiredLocatorTypes.has(type) ? { strategy: "css", value: "" } : undefined,
    url: type === "navigate" ? "https://example.com" : undefined,
    text: "",
    key: "ENTER",
    ms: 1000,
    timeout: 10000,
    onError: "stop",
    clearFirst: true,
    groupId
  };
}

export function createEmptyWorkflow(): WorkflowDocument {
  return {
    version: WORKFLOW_VERSION,
    name: "Untitled workflow",
    startUrl: "https://example.com",
    browser: "chrome",
    steps: [],
    groups: [],
    variables: []
  };
}

/** Normalizes older v1 exports and rejects malformed top-level data without silently discarding steps. */
export function normalizeWorkflow(input: unknown): WorkflowDocument {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Workflow JSON must contain an object.");
  }
  const raw = input as Record<string, unknown>;
  if (raw.version !== WORKFLOW_VERSION) {
    throw new Error(`Unsupported workflow version: ${String(raw.version)}. Expected ${WORKFLOW_VERSION}.`);
  }
  if (!Array.isArray(raw.steps)) throw new Error("Workflow JSON must include a steps array.");
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  const variables = Array.isArray(raw.variables) ? raw.variables : [];
  const document: WorkflowDocument = {
    version: WORKFLOW_VERSION,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Untitled workflow",
    startUrl: typeof raw.startUrl === "string" ? raw.startUrl : "",
    browser: raw.browser === "edge" ? "edge" : raw.browser === "chrome" ? "chrome" : (raw.browser as "chrome" | "edge"),
    steps: raw.steps as WorkflowStep[],
    groups: groups as WorkflowGroup[],
    variables: variables as WorkflowVariable[]
  };
  const result = validateWorkflow(document);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return document;
}

export function validateWorkflow(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Workflow must be an object."], warnings };
  }
  const doc = input as Partial<WorkflowDocument>;
  if (doc.version !== WORKFLOW_VERSION) errors.push(`Workflow version must be ${WORKFLOW_VERSION}.`);
  if (typeof doc.startUrl !== "string") errors.push("Start URL must be a string.");
  else if (doc.startUrl.trim()) {
    try {
      const parsed = new URL(doc.startUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) errors.push("Start URL must use http or https.");
    } catch { errors.push("Start URL must be a valid absolute http(s) URL."); }
  } else warnings.push("Start URL is empty. Set it before running the workflow.");
  if (doc.browser !== "chrome" && doc.browser !== "edge") errors.push("Browser must be chrome or edge.");
  if (doc.name !== undefined && (typeof doc.name !== "string" || !doc.name.trim())) errors.push("Workflow name cannot be empty.");
  if (!Array.isArray(doc.steps)) errors.push("Steps must be an array.");
  if (doc.groups !== undefined && !Array.isArray(doc.groups)) errors.push("Groups must be an array.");
  if (doc.variables !== undefined && !Array.isArray(doc.variables)) errors.push("Variables must be an array.");

  const groupIds = new Set<string>();
  if (Array.isArray(doc.groups)) {
    doc.groups.forEach((group, index) => {
      if (!group || typeof group !== "object") { errors.push(`Group ${index + 1} must be an object.`); return; }
      if (typeof group.id !== "string" || !group.id.trim()) errors.push(`Group ${index + 1} needs an id.`);
      else if (groupIds.has(group.id)) errors.push(`Group ${index + 1} has a duplicate id.`);
      else groupIds.add(group.id);
      if (typeof group.name !== "string" || !group.name.trim()) errors.push(`Group ${index + 1} needs a name.`);
    });
  }

  const variableNames = new Set<string>();
  if (Array.isArray(doc.variables)) {
    doc.variables.forEach((variable, index) => {
      if (!variable || typeof variable !== "object") { errors.push(`Variable ${index + 1} must be an object.`); return; }
      if (typeof variable.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name)) {
        errors.push(`Variable ${index + 1} name must start with a letter or underscore and contain only letters, numbers, and underscores.`);
      } else if (variableNames.has(variable.name)) errors.push(`Variable name "${variable.name}" is duplicated.`);
      else variableNames.add(variable.name);
      if (typeof variable.value !== "string") errors.push(`Variable ${index + 1} value must be a string.`);
      if (typeof variable.id !== "string" || !variable.id.trim()) errors.push(`Variable ${index + 1} needs an id.`);
    });
  }

  if (Array.isArray(doc.steps)) {
    if (doc.steps.length === 0) warnings.push("Workflow has no steps yet. Add a step before running it.");
    const ids = new Set<string>();
    doc.steps.forEach((step, index) => {
      const n = index + 1;
      if (!step || typeof step !== "object" || Array.isArray(step)) { errors.push(`Step ${n} must be an object.`); return; }
      if (typeof step.id !== "string" || !step.id.trim()) errors.push(`Step ${n} needs an id.`);
      else if (ids.has(step.id)) errors.push(`Step ${n} has a duplicate id.`);
      else ids.add(step.id);
      if (typeof step.name !== "string" || !step.name.trim()) errors.push(`Step ${n} needs a name.`);
      if (typeof step.type !== "string" || !stepTypes.includes(step.type as StepType)) {
        errors.push(`Step ${n} has an unsupported action type.`);
        return;
      }
      const type = step.type as StepType;
      if (step.disabled !== undefined && typeof step.disabled !== "boolean") errors.push(`Step ${n} disabled must be true or false.`);
      if (step.onError !== undefined && step.onError !== "stop" && step.onError !== "continue") errors.push(`Step ${n} has an invalid error policy.`);
      if (step.timeout !== undefined && (!Number.isFinite(step.timeout) || (step.timeout as number) < 0)) errors.push(`Step ${n} timeout must be a non-negative number.`);
      if (step.retry !== undefined) {
        if (!step.retry || !Number.isInteger(step.retry.attempts) || step.retry.attempts < 1 || step.retry.attempts > 10) errors.push(`Step ${n} retry attempts must be an integer from 1 to 10.`);
        if (step.retry && step.retry.delayMs !== undefined && (!Number.isFinite(step.retry.delayMs) || step.retry.delayMs < 0 || step.retry.delayMs > 30000)) errors.push(`Step ${n} retry delay must be between 0 and 30000 ms.`);
      }
      if (["wait"].includes(type) && step.ms !== undefined && (!Number.isFinite(step.ms) || (step.ms as number) < 0)) errors.push(`Step ${n} wait duration must be a non-negative number.`);
      if (type === "navigate" && (typeof step.url !== "string" || !isHttpUrl(step.url))) errors.push(`Step ${n} needs a valid http(s) URL.`);
      if (type === "key" && (typeof step.key !== "string" || !step.key.trim())) errors.push(`Step ${n} needs a key or shortcut.`);
      if (type === "assertText" && typeof step.expected !== "string") errors.push(`Step ${n} needs expected text.`);
      if (type === "type" && typeof step.text !== "string") errors.push(`Step ${n} needs text to type.`);
      if (type === "select" && typeof step.text !== "string") errors.push(`Step ${n} needs an option value.`);
      if (requiredLocatorTypes.has(type)) {
        const target = step.target as Partial<Locator> | undefined;
        if (!target || !locatorStrategies.includes(target.strategy as LocatorStrategy) || typeof target.value !== "string" || !target.value.trim()) {
          errors.push(`Step ${n} (${step.name || type}) needs a valid locator strategy and non-empty locator value.`);
        }
      } else if (step.target !== undefined) {
        const target = step.target as Partial<Locator>;
        if (!target || !locatorStrategies.includes(target.strategy as LocatorStrategy) || typeof target.value !== "string") {
          errors.push(`Step ${n} has an invalid target locator.`);
        }
      }
      if (step.groupId !== undefined && (typeof step.groupId !== "string" || !groupIds.has(step.groupId))) {
        errors.push(`Step ${n} refers to a group that does not exist.`);
      }
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}

function isHttpUrl(value: string): boolean {
  try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:"; }
  catch { return false; }
}

export function serializeWorkflow(doc: WorkflowDocument): string {
  const result = validateWorkflow(doc);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return JSON.stringify(doc, null, 2);
}
