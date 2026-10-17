export const WORKFLOW_VERSION = 1 as const;

export type LocatorStrategy =
  | "xpath" | "css" | "id" | "name" | "linkText" | "className" | "tagName";

export type StepType =
  | "click" | "type" | "key" | "navigate"
  | "waitVisible" | "waitClickable" | "wait" | "assertText"
  | "select" | "userInput" | "runWorkflow" | "screenshot" | "saveSession" | "loadSession" | "back" | "forward" | "refresh"
  | "hover" | "rightClick" | "doubleClick" | "dragDrop" | "scrollTo" | "scroll"
  | "uploadFile" | "waitDownload" | "extractText" | "extractAttribute" | "extractValue" | "extractTable" | "saveText" | "saveImage"
  | "assertUrl" | "assertExists" | "assertCount" | "assertTitle" | "assertAttribute"
  | "alertAccept" | "alertDismiss" | "openTab" | "closeTab" | "switchWindow" | "switchFrame" | "switchFrameDefault"
  | "ifElse" | "repeat" | "loopList" | "while" | "breakLoop" | "continueLoop" | "setVariable" | "regexReplace" | "extractAll" | "operateAll";

export type OnErrorPolicy = "stop" | "continue";

export interface Locator {
  strategy: LocatorStrategy;
  value: string;
}


export interface StepCondition {
  source: "variable" | "lastText" | "url" | "urlChanged" | "stepStatus";
  key?: string;
  operator: "equals" | "notEquals" | "contains" | "notContains" | "matches" | "greaterThan" | "lessThan" | "truthy" | "falsy";
  expected?: string;
}

export interface StepRetry {
  attempts: number;
  delayMs: number;
}

export interface UserInputField {
  id: string;
  title: string;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
  valueType?: "text" | "number" | "boolean" | "choice" | "regex";
  pattern?: string;
  options?: string[];
  variableName?: string;
  target: Locator;
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
  inputs?: UserInputField[];
  workflowId?: string;
  target2?: Locator;
  attribute?: string;
  outputName?: string;
  sessionName?: string;
  profileName?: string;
  bulkOperation?: "click" | "type" | "extractText" | "extractAttribute" | "extractValue";
  filePath?: string;
  scrollAmount?: number;
  repeatCount?: number;
  listExpression?: string;
  itemVariable?: string;
  thenSteps?: WorkflowStep[];
  elseSteps?: WorkflowStep[];
  loopSteps?: WorkflowStep[];
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
  valueType?: "text" | "number" | "boolean" | "json";
  scope?: "workflow" | "run";
  description?: string;
}

export interface WorkflowDocument {
  version: typeof WORKFLOW_VERSION;
  name: string;
  startUrl: string;
  browser: "chrome" | "edge";
  profileName?: string;
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
  "wait", "assertText", "select", "userInput", "runWorkflow", "screenshot", "saveSession", "loadSession", "back", "forward", "refresh",
  "hover", "rightClick", "doubleClick", "dragDrop", "scrollTo", "scroll", "uploadFile", "waitDownload",
  "extractText", "extractAttribute", "extractValue", "extractTable", "saveText", "saveImage",
  "assertUrl", "assertExists", "assertCount", "assertTitle", "assertAttribute", "alertAccept", "alertDismiss",
  "openTab", "closeTab", "switchWindow", "switchFrame", "switchFrameDefault", "ifElse", "repeat", "loopList", "while", "breakLoop", "continueLoop", "setVariable", "regexReplace", "extractAll", "operateAll"
];
const requiredLocatorTypes = new Set<StepType>([
  "click", "type", "waitVisible", "waitClickable", "assertText", "select", "hover", "rightClick", "doubleClick",
  "scrollTo", "uploadFile", "extractText", "extractAttribute", "extractValue", "extractTable", "saveImage",
  "assertExists", "assertCount", "assertAttribute", "switchFrame", "dragDrop", "extractAll", "operateAll"
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
    userInput: "Ask user for inputs",
    runWorkflow: "Run another workflow",
    screenshot: "Take screenshot",
    saveSession: "Save browser session",
    loadSession: "Load saved browser session",
    back: "Go back",
    forward: "Go forward",
    refresh: "Refresh page", setVariable: "Set variable", regexReplace: "Regex edit variable", extractAll: "Extract all matching elements", operateAll: "Operate on all matching elements", hover: "Hover over element", rightClick: "Right-click element", doubleClick: "Double-click element",
    dragDrop: "Drag and drop", scrollTo: "Scroll to element", scroll: "Scroll page", uploadFile: "Upload file",
    waitDownload: "Wait for download", extractText: "Extract element text", extractAttribute: "Extract attribute",
    extractValue: "Extract input value", extractTable: "Extract table to CSV", saveText: "Save text output", saveImage: "Save image from element",
    assertUrl: "Assert current URL", assertExists: "Assert element exists", assertCount: "Assert element count",
    assertTitle: "Assert page title", assertAttribute: "Assert attribute", alertAccept: "Accept browser alert", alertDismiss: "Dismiss browser alert",
    openTab: "Open new tab", closeTab: "Close current tab", switchWindow: "Switch browser tab", switchFrame: "Switch into frame", switchFrameDefault: "Return to main page from frame",
    ifElse: "If / else block", repeat: "Repeat steps", loopList: "Loop over list", while: "While condition is true", breakLoop: "Break loop", continueLoop: "Continue loop"
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
    groupId,
    workflowId: type === "runWorkflow" ? "" : undefined,
    inputs: type === "userInput" ? [{ id: createId(), title: "Value", placeholder: "Enter a value", required: true, secret: false, target: { strategy: "css", value: "" } }] : undefined,
    outputName: ["saveText", "saveImage", "extractText", "extractAttribute", "extractValue", "extractTable", "extractAll", "setVariable"].includes(type) ? "result" : undefined,
    bulkOperation: type === "operateAll" ? "click" : undefined,
    attribute: type === "extractAttribute" || type === "assertAttribute" ? "href" : undefined,
    scrollAmount: type === "scroll" ? 600 : undefined,
    repeatCount: type === "repeat" ? 2 : type === "while" ? 100 : undefined,
    itemVariable: type === "loopList" ? "item" : undefined,
    listExpression: type === "loopList" ? "one,two,three" : undefined,
    thenSteps: type === "ifElse" ? [] : undefined,
    elseSteps: type === "ifElse" ? [] : undefined,
    loopSteps: type === "repeat" || type === "loopList" || type === "while" ? [] : undefined
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
    profileName: typeof raw.profileName === "string" ? raw.profileName : undefined,
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
      if (variable.valueType !== undefined && !["text", "number", "boolean", "json"].includes(variable.valueType)) errors.push(`Variable ${index + 1} has an unsupported value type.`);
      if (variable.scope !== undefined && !["workflow", "run"].includes(variable.scope)) errors.push(`Variable ${index + 1} has an unsupported scope.`);
      if (variable.description !== undefined && typeof variable.description !== "string") errors.push(`Variable ${index + 1} description must be text.`);
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
      if (step.condition !== undefined) {
        const condition = step.condition;
        if (!condition || !["variable", "lastText", "url", "urlChanged", "stepStatus"].includes(condition.source) || !["equals", "notEquals", "contains", "notContains", "matches", "greaterThan", "lessThan", "truthy", "falsy"].includes(condition.operator)) errors.push(`Step ${n} has an invalid condition.`);
        if (condition && ["variable", "stepStatus"].includes(condition.source) && (!condition.key || !condition.key.trim())) errors.push(`Step ${n} condition needs a key.`);
      }
      if (["wait"].includes(type) && step.ms !== undefined && (!Number.isFinite(step.ms) || (step.ms as number) < 0)) errors.push(`Step ${n} wait duration must be a non-negative number.`);
      if (type === "navigate" && (typeof step.url !== "string" || !isHttpUrl(step.url))) errors.push(`Step ${n} needs a valid http(s) URL.`);
      if (type === "openTab" && step.url !== undefined && step.url !== "about:blank" && (typeof step.url !== "string" || !isHttpUrl(step.url))) errors.push(`Step ${n} new-tab URL must use http(s) or about:blank.`);
      if (type === "runWorkflow" && (typeof step.workflowId !== "string" || !step.workflowId.trim())) errors.push(`Step ${n} must select a workflow to run.`);
      if (type === "key" && (typeof step.key !== "string" || !step.key.trim())) errors.push(`Step ${n} needs a key or shortcut.`);
      if (type === "assertText" && typeof step.expected !== "string") errors.push(`Step ${n} needs expected text.`);
      if (["assertUrl", "assertTitle"].includes(type) && (typeof step.expected !== "string" || !step.expected.trim())) errors.push(`Step ${n} needs an expected value.`);
      if (type === "type" && typeof step.text !== "string") errors.push(`Step ${n} needs text to type.`);
      if (type === "select" && typeof step.text !== "string") errors.push(`Step ${n} needs an option value.`);
      if (["extractAttribute", "assertAttribute"].includes(type) && (!step.attribute || !step.attribute.trim())) errors.push(`Step ${n} needs an attribute name.`);
      if (["extractText", "extractAttribute", "extractValue", "extractTable"].includes(type) && step.outputName !== undefined && (typeof step.outputName !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(step.outputName))) errors.push(`Step ${n} output variable must start with a letter or underscore and contain only letters, numbers, and underscores.`);
      if (["setVariable", "regexReplace", "extractAll"].includes(type) && (typeof step.outputName !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(step.outputName))) errors.push(`Step ${n} needs a valid output variable name.`);
      if (type === "operateAll" && (!["click", "type", "extractText", "extractAttribute", "extractValue"].includes(step.bulkOperation || "") || (step.bulkOperation === "extractAttribute" && (!step.attribute || !step.attribute.trim())))) errors.push(`Step ${n} needs a supported bulk operation and an attribute when extracting attributes.`);
      if (type === "extractAll" && step.bulkOperation !== undefined && !["extractText", "extractAttribute", "extractValue"].includes(step.bulkOperation)) errors.push(`Step ${n} has an unsupported extraction mode.`);
      if (type === "operateAll" && String(step.bulkOperation || "").startsWith("extract") && (typeof step.outputName !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(step.outputName))) errors.push(`Step ${n} needs a valid output variable for extraction.`);
      if (["setVariable", "regexReplace"].includes(type) && typeof step.text !== "string") errors.push(`Step ${n} needs a source value or expression.`);
      if (type === "regexReplace") { if (typeof step.expected !== "string" || step.expected.length > 500) errors.push(`Step ${n} needs a regex pattern no longer than 500 characters.`); else { try { new RegExp(step.expected); } catch { errors.push(`Step ${n} has an invalid regex pattern.`); } } }
      if (type === "dragDrop") {
        const target2 = step.target2 as Partial<Locator> | undefined;
        if (!target2 || !locatorStrategies.includes(target2.strategy as LocatorStrategy) || typeof target2.value !== "string" || !target2.value.trim()) errors.push(`Step ${n} needs a destination locator for drag and drop.`);
      }
      if (type === "uploadFile" && (typeof step.filePath !== "string" || !step.filePath.trim())) errors.push(`Step ${n} needs a file path to upload.`);
      if (type === "waitDownload" && step.timeout !== undefined && (!Number.isFinite(step.timeout) || (step.timeout as number) < 1)) errors.push(`Step ${n} download timeout must be positive.`);
      if (type === "repeat" && (!Number.isInteger(step.repeatCount) || (step.repeatCount as number) < 1 || (step.repeatCount as number) > 1000)) errors.push(`Step ${n} repeat count must be between 1 and 1000.`);
      if (type === "loopList" && (!Array.isArray(step.loopSteps) || typeof step.listExpression !== "string" || !step.listExpression.trim())) errors.push(`Step ${n} needs a list and nested steps.`);
      if (type === "loopList" && step.itemVariable !== undefined && (typeof step.itemVariable !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(step.itemVariable))) errors.push(`Step ${n} item variable must be a valid identifier.`);
      if (type === "while" && (!step.condition || !Array.isArray(step.loopSteps) || !Number.isInteger(step.repeatCount) || (step.repeatCount as number) < 1 || (step.repeatCount as number) > 1000)) errors.push(`Step ${n} while loop needs a condition, nested steps, and a 1-1000 iteration limit.`);
      if (type === "ifElse" && (!step.condition || !Array.isArray(step.thenSteps) || !Array.isArray(step.elseSteps))) errors.push(`Step ${n} needs a condition and then/else step arrays.`);
      if (type === "userInput") {
        if (!Array.isArray(step.inputs) || step.inputs.length < 1 || step.inputs.length > 30) errors.push(`Step ${n} must have between 1 and 30 user input fields.`);
        else step.inputs.forEach((field, fieldIndex) => {
          const label = `Step ${n} input ${fieldIndex + 1}`;
          if (!field || typeof field !== "object") { errors.push(`${label} must be an object.`); return; }
          if (typeof field.id !== "string" || !field.id.trim()) errors.push(`${label} needs an id.`);
          if (typeof field.title !== "string" || !field.title.trim()) errors.push(`${label} needs a title.`);
          if (field.placeholder !== undefined && typeof field.placeholder !== "string") errors.push(`${label} placeholder must be text.`);
          if (field.required !== undefined && typeof field.required !== "boolean") errors.push(`${label} required must be true or false.`);
          if (field.secret !== undefined && typeof field.secret !== "boolean") errors.push(`${label} secret must be true or false.`);
          if (field.valueType !== undefined && !["text", "number", "boolean", "choice", "regex"].includes(field.valueType)) errors.push(`${label} has an unsupported input type.`);
          if (field.pattern !== undefined && (typeof field.pattern !== "string" || field.pattern.length > 500)) errors.push(`${label} regex must be text no longer than 500 characters.`);
          if (field.valueType === "regex" && (typeof field.pattern !== "string" || !field.pattern.trim())) errors.push(`${label} needs a regex pattern when using regex-validated input.`);
          if (field.pattern) { try { new RegExp(field.pattern); } catch { errors.push(`${label} regex is invalid.`); } }
          if (field.variableName !== undefined && (typeof field.variableName !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.variableName))) errors.push(`${label} variable name must be a valid identifier.`);
          if (field.valueType === "choice" && (!Array.isArray(field.options) || field.options.length < 2 || field.options.length > 100 || field.options.some(option => typeof option !== "string" || !option.trim()))) errors.push(`${label} needs between 2 and 100 non-empty choice options.`);
          const target = field.target as Partial<Locator> | undefined;
          if (!field.variableName && (!target || !locatorStrategies.includes(target.strategy as LocatorStrategy) || typeof target.value !== "string" || !target.value.trim())) errors.push(`${label} needs a target locator or a variable name to capture the answer.`);
          if (field.variableName && target?.value && (!locatorStrategies.includes(target.strategy as LocatorStrategy) || typeof target.value !== "string")) errors.push(`${label} has an invalid optional target locator.`);
        });
      }
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
