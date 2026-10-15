/**
 * FlowForge Selenium runner.
 * Protocol: one JSON object per stdout line. Diagnostic text is never written to stdout.
 */
"use strict";

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_WAIT_MS = 300_000;

const LOCATOR_NAMES = new Set(["xpath", "css", "id", "name", "linkText", "className", "tagName"]);
const STEP_TYPES = new Set([
  "click", "type", "key", "navigate", "waitVisible", "waitClickable", "wait",
  "assertText", "select", "userInput", "runWorkflow", "screenshot", "back", "forward", "refresh",
  "hover", "rightClick", "doubleClick", "dragDrop", "scrollTo", "scroll", "uploadFile", "waitDownload",
  "extractText", "extractAttribute", "extractValue", "extractTable", "saveText", "saveImage",
  "assertUrl", "assertExists", "assertCount", "assertTitle", "assertAttribute", "alertAccept", "alertDismiss",
  "openTab", "closeTab", "switchWindow", "switchFrame", "switchFrameDefault", "ifElse", "repeat", "loopList", "while", "breakLoop", "continueLoop"
]);
const LOCATOR_STEP_TYPES = new Set(["click", "type", "waitVisible", "waitClickable", "assertText", "select", "hover", "rightClick", "doubleClick", "scrollTo", "uploadFile", "extractText", "extractAttribute", "extractValue", "extractTable", "saveImage", "assertExists", "assertCount", "assertAttribute", "switchFrame", "dragDrop"]);

function stepRequiresLocator(stepType) {
  return LOCATOR_STEP_TYPES.has(stepType);
}

async function runWithRetry(action, options = {}, onRetry = () => {}) {
  const attempts = Math.max(1, Math.min(10, Math.floor(Number(options.attempts || 1)) || 1));
  const delayMs = Math.max(0, Math.min(30_000, Math.floor(Number(options.delayMs || 0)) || 0));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await action(); } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        onRetry({ attempt, nextAttempt: attempt + 1, attempts, delayMs, error: normalizeError(error).message });
        if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function asBoundedNumber(value, fallback, max, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number.`);
  return Math.min(Math.floor(number), max);
}

function normalizeOptimizations(value = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const strategy = raw.pageLoadStrategy || "normal";
  if (!["normal", "eager", "none"].includes(strategy)) throw new Error("Page load strategy must be normal, eager, or none.");
  for (const key of ["disableImages", "disableCss", "disableFonts", "disableMedia"]) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") throw new Error(`${key} must be a boolean.`);
  }
  return {
    disableImages: raw.disableImages === true,
    disableCss: raw.disableCss === true,
    disableFonts: raw.disableFonts === true,
    disableMedia: raw.disableMedia === true,
    pageLoadStrategy: strategy
  };
}

function buildBlockedUrlPatterns(optimizations = {}) {
  const patterns = [];
  if (optimizations.disableCss) patterns.push("*.css", "*.css?*");
  if (optimizations.disableFonts) patterns.push("*.woff", "*.woff?*", "*.woff2", "*.woff2?*", "*.ttf", "*.ttf?*", "*.otf", "*.otf?*");
  if (optimizations.disableMedia) patterns.push("*.mp4", "*.mp4?*", "*.webm", "*.webm?*", "*.mp3", "*.mp3?*", "*.wav", "*.wav?*", "*.ogg", "*.ogg?*");
  if (optimizations.disableImages) patterns.push("*.png", "*.png?*", "*.jpg", "*.jpg?*", "*.jpeg", "*.jpeg?*", "*.gif", "*.gif?*", "*.webp", "*.webp?*", "*.avif", "*.avif?*", "*.ico", "*.ico?*");
  return [...new Set(patterns)];
}

function validatePayload(payload, depth = 0) {
  if (depth > 10) throw new Error("Nested control-flow blocks exceed the depth limit of 10.");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Engine payload must be an object.");
  }
  if (!Array.isArray(payload.steps)) throw new Error("Engine payload must include a steps array.");
  if (payload.steps.length > 10_000) throw new Error("Workflow exceeds the 10,000-step safety limit.");
  if (payload.startUrl && !isHttpUrl(payload.startUrl)) throw new Error("Start URL must use http or https.");
  const browser = payload.browser || payload.profile?.browser || "chrome";
  if (!["chrome", "edge"].includes(browser)) throw new Error(`Unsupported browser: ${browser}`);
  for (let i = 0; i < payload.steps.length; i++) {
    const step = payload.steps[i];
    if (!step || typeof step !== "object" || Array.isArray(step)) throw new Error(`Step ${i + 1} must be an object.`);
    if (!STEP_TYPES.has(step.type)) throw new Error(`Step ${i + 1} has unsupported type "${String(step.type)}".`);
    if (step.timeout !== undefined) asBoundedNumber(step.timeout, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, `Step ${i + 1} timeout`);
    if (step.retry !== undefined) {
      if (!step.retry || typeof step.retry !== "object" || !Number.isInteger(step.retry.attempts) || step.retry.attempts < 1 || step.retry.attempts > 10) throw new Error(`Step ${i + 1} retry attempts must be an integer from 1 to 10.`);
      if (step.retry.delayMs !== undefined && (!Number.isFinite(step.retry.delayMs) || step.retry.delayMs < 0 || step.retry.delayMs > 30_000)) throw new Error(`Step ${i + 1} retry delay must be between 0 and 30000 ms.`);
    }
    if (step.type === "wait") asBoundedNumber(step.ms, 1000, MAX_WAIT_MS, `Step ${i + 1} wait duration`);
    if (step.type === "dragDrop" && (!step.target2 || !LOCATOR_NAMES.has(step.target2.strategy) || typeof step.target2.value !== "string" || !step.target2.value.trim())) throw new Error(`Step ${i + 1} needs a destination locator for drag and drop.`);
    if (["extractAttribute", "assertAttribute"].includes(step.type) && (typeof step.attribute !== "string" || !step.attribute.trim())) throw new Error(`Step ${i + 1} needs an attribute name.`);
    if (["extractText", "extractAttribute", "extractValue", "extractTable"].includes(step.type) && step.outputName !== undefined && (typeof step.outputName !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(step.outputName))) throw new Error(`Step ${i + 1} output variable must be a valid identifier.`);
    if (step.type === "uploadFile" && (typeof step.filePath !== "string" || !step.filePath.trim())) throw new Error(`Step ${i + 1} needs a file path.`);
    if (["assertUrl", "assertTitle"].includes(step.type) && (typeof step.expected !== "string" || !step.expected.trim())) throw new Error(`Step ${i + 1} needs an expected value.`);
    if (step.type === "repeat" && (!Number.isInteger(step.repeatCount) || step.repeatCount < 1 || step.repeatCount > 1000 || !Array.isArray(step.loopSteps))) throw new Error(`Step ${i + 1} repeat count must be 1-1000 and include loopSteps.`);
    if (step.type === "loopList" && (typeof step.listExpression !== "string" || !step.listExpression.trim() || !Array.isArray(step.loopSteps))) throw new Error(`Step ${i + 1} needs listExpression and loopSteps.`);
    if (step.type === "loopList" && step.itemVariable !== undefined && (typeof step.itemVariable !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(step.itemVariable))) throw new Error(`Step ${i + 1} item variable must be a valid identifier.`);
    if (step.condition !== undefined) {
      const condition = step.condition;
      if (!condition || typeof condition !== "object" || !["variable", "lastText", "url", "stepStatus"].includes(condition.source) || !["equals", "notEquals", "contains", "notContains", "matches", "greaterThan", "lessThan", "truthy", "falsy"].includes(condition.operator)) throw new Error(`Step ${i + 1} has an invalid condition.`);
      if (["variable", "stepStatus"].includes(condition.source) && (typeof condition.key !== "string" || !condition.key.trim())) throw new Error(`Step ${i + 1} condition needs a key.`);
      if (condition.expected !== undefined && typeof condition.expected !== "string") throw new Error(`Step ${i + 1} condition expected value must be text.`);
    }
    const nestedStepArrays = step.type === "ifElse" ? [step.thenSteps, step.elseSteps] : ["repeat", "loopList", "while"].includes(step.type) ? [step.loopSteps] : [];
    for (const nestedSteps of nestedStepArrays) {
      if (!Array.isArray(nestedSteps)) continue;
      if (nestedSteps.length > 10_000) throw new Error(`Step ${i + 1} nested block exceeds the 10,000-step safety limit.`);
      validatePayload({ steps: nestedSteps, browser, workflowLibrary: payload.workflowLibrary }, depth + 1);
    }
    if (step.type === "while" && (!step.condition || !Array.isArray(step.loopSteps) || !Number.isInteger(step.repeatCount) || step.repeatCount < 1 || step.repeatCount > 1000)) throw new Error(`Step ${i + 1} while loop needs a condition, nested steps, and a 1-1000 iteration limit.`);
    if (step.type === "ifElse" && (!step.condition || !Array.isArray(step.thenSteps) || !Array.isArray(step.elseSteps))) throw new Error(`Step ${i + 1} needs a condition and thenSteps/elseSteps.`);
    if (stepRequiresLocator(step.type)) {
      if (!step.target || !LOCATOR_NAMES.has(step.target.strategy) || typeof step.target.value !== "string" || !step.target.value.trim()) {
        throw new Error(`Step ${i + 1} (${step.type}) needs a supported locator and a non-empty locator value.`);
      }
    }
    if (step.type === "navigate" && !isHttpUrl(step.url)) throw new Error(`Step ${i + 1} needs a valid http(s) URL.`);
    if (step.type === "openTab" && step.url !== undefined && step.url !== "about:blank" && !isHttpUrl(step.url)) throw new Error(`Step ${i + 1} new-tab URL must use http(s) or about:blank.`);
    if (step.type === "runWorkflow" && (typeof step.workflowId !== "string" || !step.workflowId.trim())) throw new Error(`Step ${i + 1} must select a workflow to run.`);
    if (step.type === "runWorkflow" && (!payload.workflowLibrary || typeof payload.workflowLibrary !== "object" || !payload.workflowLibrary[step.workflowId])) throw new Error(`Step ${i + 1} references a workflow that is not in the supplied library.`);
    if (step.type === "key" && (typeof step.key !== "string" || !step.key.trim())) throw new Error(`Step ${i + 1} needs a key or shortcut.`);
    if (step.type === "userInput") {
      if (!Array.isArray(step.inputs) || step.inputs.length < 1 || step.inputs.length > 30) throw new Error(`Step ${i + 1} must have between 1 and 30 user input fields.`);
      for (let fieldIndex = 0; fieldIndex < step.inputs.length; fieldIndex++) {
        const field = step.inputs[fieldIndex];
        if (!field || typeof field !== "object" || typeof field.id !== "string" || !field.id.trim() || typeof field.title !== "string" || !field.title.trim()) throw new Error(`Step ${i + 1} input ${fieldIndex + 1} needs an id and title.`);
        if (!field.target || !LOCATOR_NAMES.has(field.target.strategy) || typeof field.target.value !== "string" || !field.target.value.trim()) throw new Error(`Step ${i + 1} input "${field.title}" needs a valid target locator.`);
        if (field.required !== undefined && typeof field.required !== "boolean") throw new Error(`Step ${i + 1} input "${field.title}" required must be boolean.`);
        if (field.secret !== undefined && typeof field.secret !== "boolean") throw new Error(`Step ${i + 1} input "${field.title}" secret must be boolean.`);
      }
    }
  }
  return { ...payload, browser, optimizations: normalizeOptimizations(payload.optimizations) };
}

function substituteVariables(value, variables = {}) {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      throw new Error(`Unknown workflow variable "${name}".`);
    }
    return String(variables[name] ?? "");
  });
}

function buildLocator(By, target) {
  if (!target || typeof target.value !== "string" || !target.value.trim()) {
    throw new Error("Missing locator value.");
  }
  const strategies = {
    xpath: By.xpath, css: By.css, id: By.id, name: By.name,
    linkText: By.linkText, className: By.className, tagName: By.tagName
  };
  const factory = strategies[target.strategy];
  if (!factory) throw new Error(`Unsupported locator strategy: ${String(target.strategy)}`);
  return factory(target.value);
}


function createElementWaiters(driver, by, timeout, locatorDescription = "element") {
  const locate = () => driver.wait(async () => {
    try { return await driver.findElement(by); } catch { return false; }
  }, timeout, `Timed out after ${timeout}ms locating ${locatorDescription}`, 200);
  const visible = () => driver.wait(async () => {
    try {
      const element = await driver.findElement(by);
      return await element.isDisplayed() ? element : false;
    } catch { return false; }
  }, timeout, `Element ${locatorDescription} did not become visible within ${timeout}ms`, 200);
  const clickable = () => driver.wait(async () => {
    try {
      const element = await driver.findElement(by);
      if (!(await element.isDisplayed())) return false;
      if (!(await element.isEnabled())) return false;
      return element;
    } catch { return false; }
  }, timeout, `Element ${locatorDescription} did not become clickable within ${timeout}ms`, 200);
  return { locate, visible, clickable };
}

function parseKeySequence(raw, Key) {
  const aliases = {
    CTRL: "CONTROL", CONTROL: "CONTROL", CMD: "COMMAND", COMMAND: "COMMAND",
    ALT: "ALT", SHIFT: "SHIFT", META: "META", ENTER: "ENTER", RETURN: "ENTER",
    ESC: "ESC", ESCAPE: "ESC", TAB: "TAB", SPACE: "SPACE", BACKSPACE: "BACK_SPACE",
    DELETE: "DELETE", DEL: "DELETE", UP: "ARROW_UP", DOWN: "ARROW_DOWN",
    LEFT: "ARROW_LEFT", RIGHT: "ARROW_RIGHT", HOME: "HOME", END: "END",
    PAGEUP: "PAGE_UP", PAGEDOWN: "PAGE_DOWN"
  };
  const parts = String(raw).split("+").map(x => x.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Key sequence is empty.");
  return parts.map(part => {
    const normalized = part.toUpperCase();
    const keyName = aliases[normalized] || normalized;
    if (Object.prototype.hasOwnProperty.call(Key, keyName)) return Key[keyName];
    if (part.length === 1) return part;
    throw new Error(`Unsupported key "${part}". Use a supported key name or a single character.`);
  });
}


function evaluateRuntimeCondition(condition, context) {
  let actual;
  switch (condition.source) {
    case "variable":
      if (!Object.prototype.hasOwnProperty.call(context.variables, condition.key || "")) throw new Error(`Condition refers to unknown variable "${condition.key || ""}".`);
      actual = String(context.variables[condition.key]);
      break;
    case "lastText": actual = context.lastText; break;
    case "url": actual = context.url; break;
    case "stepStatus":
      if (!Object.prototype.hasOwnProperty.call(context.stepStatus, condition.key || "")) throw new Error(`Condition refers to unknown step id "${condition.key || ""}".`);
      actual = context.stepStatus[condition.key];
      break;
    default: throw new Error("Unsupported condition source.");
  }
  const expected = String(condition.expected ?? "");
  switch (condition.operator) {
    case "equals": return actual === expected;
    case "notEquals": return actual !== expected;
    case "contains": return String(actual).includes(expected);
    case "notContains": return !String(actual).includes(expected);
    case "matches":
      if (expected.length > 500) throw new Error("Regular expression exceeds 500 characters.");
      try { return new RegExp(expected).test(String(actual)); } catch { throw new Error("Invalid condition regular expression."); }
    case "greaterThan":
    case "lessThan": {
      const a = Number(actual), b = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Numeric condition requires numeric values.");
      return condition.operator === "greaterThan" ? a > b : a < b;
    }
    case "truthy": return String(actual).length > 0 && actual !== "false" && actual !== "0";
    case "falsy": return String(actual).length === 0 || actual === "false" || actual === "0";
    default: throw new Error("Unsupported condition operator.");
  }
}

function resolveDriverPath(browserName, env = process.env, existsSync = fsSync.existsSync, platform = process.platform) {
  const isEdge = browserName === "edge";
  const envKey = isEdge ? "FLOWFORGE_EDGEDRIVER_PATH" : "FLOWFORGE_CHROMEDRIVER_PATH";
  const candidates = [];
  if (env && typeof env[envKey] === "string" && env[envKey].trim()) candidates.push(env[envKey].trim());
  if (platform === "win32") {
    candidates.push(isEdge
      ? "C:\\WebDriver\\msedgedriver\\msedgedriver.exe"
      : "C:\\WebDriver\\chromedriver\\chromedriver.exe");
  }
  for (const candidate of candidates) {
    try { if (existsSync(candidate)) return candidate; } catch { /* Ignore inaccessible paths and try the next candidate. */ }
  }
  return null;
}

function normalizeError(error) {
  if (error instanceof Error) return { message: error.message, name: error.name };
  return { message: String(error), name: "Error" };
}

function emit(type, data) {
  process.stdout.write(`${JSON.stringify({ type, data, at: new Date().toISOString() })}\n`);
}

async function runWorkflow(rawPayload, deps = {}) {
  const payload = validatePayload(rawPayload);
  const selenium = deps.selenium || require("selenium-webdriver");
  const { Builder, By, Key, until } = selenium;
  const chrome = deps.chrome || require("selenium-webdriver/chrome");
  const edge = deps.edge || require("selenium-webdriver/edge");
  const Select = deps.Select || require("selenium-webdriver/lib/select").Select;
  const driverFactory = deps.driverFactory;
  const browserName = payload.browser;
  const profile = payload.profile || {};
  const optimizations = payload.optimizations;
  const runStarted = Date.now();
  const variables = Object.fromEntries((payload.variables || []).map(v => [v.name, v.value]));
  let driver;
  let stopRequested = false;
  let recording = false;
  const runtimeContext = { variables, lastText: "", url: payload.startUrl || "", stepStatus: {} };
  let recorderMode = payload.mode === "recorder";
  let lastRecorderMessage = null;
  let quitPromise;
  const pendingUserInputs = new Map();
  const outputDirectory = path.resolve(payload.outputDirectory || payload.screenshotDirectory || path.join(process.cwd(), "flowforge-outputs"));
  const outputArchivePath = typeof payload.outputArchivePath === "string" ? path.resolve(payload.outputArchivePath) : null;
  const outputManifestPath = typeof payload.outputManifestPath === "string" ? path.resolve(payload.outputManifestPath) : null;
  const outputArtifacts = [];
  const safeOutputName = (name, fallback = "output") => {
    const base = path.basename(String(name || fallback)).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.\.+/g, ".").slice(0, 150);
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(base)) return `_${base}`;
    return base || fallback;
  };
  const writeArtifact = async (name, data, contentType = "application/octet-stream") => {
    await fs.mkdir(outputDirectory, { recursive: true });
    let filename = safeOutputName(name);
    if (!path.extname(filename)) filename += contentType.startsWith("text/") ? ".txt" : contentType === "application/json" ? ".json" : ".bin";
    let target = path.join(outputDirectory, filename);
    if (!target.startsWith(outputDirectory + path.sep)) throw new Error("Output filename is not allowed.");
    if (await fs.stat(target).then(() => true, () => false)) {
      const ext = path.extname(filename), stem = path.basename(filename, ext);
      filename = `${stem}-${Date.now()}${ext}`; target = path.join(outputDirectory, filename);
    }
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
    if (buffer.length > 100 * 1024 * 1024) throw new Error("Output artifact exceeds the 100 MB per-file limit.");
    await fs.writeFile(target, buffer);
    const artifact = { name: filename, contentType, size: buffer.length, createdAt: new Date().toISOString() };
    outputArtifacts.push(artifact); emit("output-artifact", artifact);
    return target;
  };

  const stop = () => {
    stopRequested = true;
    for (const [requestId, pending] of pendingUserInputs) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Automation stopped while waiting for user input."));
      pendingUserInputs.delete(requestId);
    }
  };
  const requestUserInput = (step, index) => new Promise((resolve, reject) => {
    const requestId = require("node:crypto").randomUUID();
    const fields = step.inputs.map(field => ({ id: field.id, title: field.title, placeholder: field.placeholder || "", required: field.required !== false, secret: field.secret === true }));
    const timer = setTimeout(() => {
      pendingUserInputs.delete(requestId);
      reject(new Error("Timed out waiting for user input (10 minutes)."));
    }, 10 * 60 * 1000);
    pendingUserInputs.set(requestId, { resolve: values => { clearTimeout(timer); resolve(values); }, reject: error => { clearTimeout(timer); reject(error); }, timer });
    emit("user-input-request", { requestId, stepIndex: index, stepName: step.name || "User input", fields });
  });
  const executeNestedWorkflow = async (workflowId, depth = 1, stack = [], inheritedVariables = variables) => {
    if (depth > 10) throw new Error("Nested workflow depth exceeds the limit of 10.");
    if (stack.includes(workflowId)) throw new Error(`Nested workflow cycle detected: ${[...stack, workflowId].join(" -> ")}`);
    const library = payload.workflowLibrary && typeof payload.workflowLibrary === "object" ? payload.workflowLibrary : {};
    const child = library[workflowId];
    if (!child || !Array.isArray(child.steps)) throw new Error(`Referenced workflow "${workflowId}" was not found in the workflow library.`);
    validatePayload({ ...child, workflowLibrary: library });
    const childVariables = { ...inheritedVariables, ...Object.fromEntries((child.variables || []).map(v => [v.name, String(v.value ?? "")])) };
    const nestedRuntimeContext = { variables: childVariables, lastText: "", url: await driver.getCurrentUrl().catch(() => ""), stepStatus: {} };
    emit("subworkflow", { status: "started", workflowId, name: child.name || workflowId, depth });
    try {
      if (typeof child.startUrl === "string" && child.startUrl.trim()) {
        const childStartUrl = substituteVariables(child.startUrl, childVariables);
        if (!isHttpUrl(childStartUrl)) throw new Error(`Workflow "${child.name || workflowId}" start URL must use http or https.`);
        await driver.get(childStartUrl);
        nestedRuntimeContext.url = childStartUrl;
      }
      for (let childIndex = 0; childIndex < child.steps.length; childIndex++) {
        if (stopRequested) throw new Error("Automation stopped.");
        const nested = child.steps[childIndex];
        if (!nested || typeof nested !== "object" || !STEP_TYPES.has(nested.type)) throw new Error(`Workflow "${child.name || workflowId}" has an invalid action at step ${childIndex + 1}.`);
        if (nested.disabled) { nestedRuntimeContext.stepStatus[nested.id || String(childIndex)] = "skipped"; emit("subworkflow-step", { workflowId, index: childIndex, name: nested.name, status: "skipped" }); continue; }
        if (nested.condition) {
          let conditionPasses;
          try { conditionPasses = evaluateRuntimeCondition(nested.condition, nestedRuntimeContext); }
          catch (conditionError) { nestedRuntimeContext.stepStatus[nested.id || String(childIndex)] = "error"; if (nested.onError === "continue") { emit("subworkflow-step", { workflowId, index: childIndex, name: nested.name, status: "error", error: normalizeError(conditionError).message }); continue; } throw conditionError; }
          if (!conditionPasses) { nestedRuntimeContext.stepStatus[nested.id || String(childIndex)] = "skipped"; emit("subworkflow-step", { workflowId, index: childIndex, name: nested.name, status: "skipped", reason: "condition-false" }); continue; }
        }
        if (nested.type === "runWorkflow") {
          try { await executeNestedWorkflow(nested.workflowId, depth + 1, [...stack, workflowId], childVariables); nestedRuntimeContext.stepStatus[nested.id || String(childIndex)] = "success"; }
          catch (nestedCallError) { nestedRuntimeContext.stepStatus[nested.id || String(childIndex)] = "error"; if (nested.onError === "continue") { emit("subworkflow-step", { workflowId, index: childIndex, name: nested.name, status: "error", error: normalizeError(nestedCallError).message }); continue; } throw nestedCallError; }
          continue;
        }
        const nestedTimeout = asBoundedNumber(nested.timeout, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, "Nested step timeout");
        const nestedBy = stepRequiresLocator(nested.type) ? buildLocator(By, { strategy: nested.target?.strategy, value: substituteVariables(nested.target?.value, childVariables) }) : null;
        const nestedWaiters = createElementWaiters(driver, nestedBy, nestedTimeout, nested.target ? `${nested.target.strategy}=${nested.target.value}` : "element");
        emit("subworkflow-step", { workflowId, index: childIndex, name: nested.name || nested.type, status: "running", type: nested.type });
        try {
          await runWithRetry(async () => {
          switch (nested.type) {
            case "navigate": { const url = substituteVariables(nested.url, childVariables); if (!isHttpUrl(url)) throw new Error("Navigation URL must use http or https."); await driver.get(url); break; }
            case "click": await (await nestedWaiters.clickable()).click(); break;
            case "type": { const el = await nestedWaiters.visible(); if (nested.clearFirst !== false) await el.clear(); await el.sendKeys(substituteVariables(nested.text ?? "", childVariables)); break; }
            case "key": { const seq = parseKeySequence(substituteVariables(nested.key, childVariables), Key); const actions = driver.actions(); let modifierDown = false; for (const key of seq) { if ([Key.CONTROL,Key.SHIFT,Key.ALT,Key.COMMAND,Key.META].includes(key)) { actions.keyDown(key); modifierDown = true; } else actions.sendKeys(key); } if (modifierDown) for (const key of seq.filter(k=>[Key.CONTROL,Key.SHIFT,Key.ALT,Key.COMMAND,Key.META].includes(k)).reverse()) actions.keyUp(key); await actions.perform(); break; }
            case "wait": await new Promise(resolve => setTimeout(resolve, asBoundedNumber(nested.ms, 1000, MAX_WAIT_MS, "Nested wait duration"))); break;
            case "waitVisible": await nestedWaiters.visible(); break;
            case "waitClickable": await nestedWaiters.clickable(); break;
            case "assertText": { const el = await nestedWaiters.visible(); const actual = await el.getText(); nestedRuntimeContext.lastText = actual; const expected = substituteVariables(nested.expected ?? "", childVariables); if (!actual.includes(expected)) throw new Error(`Text assertion failed. Expected to contain "${expected}".`); break; }
            case "select": { const el = await nestedWaiters.clickable(); await new Select(el).selectByValue(substituteVariables(nested.text ?? "", childVariables)); break; }
            case "hover": await driver.actions({ async: true }).move({ origin: await nestedWaiters.visible() }).perform(); break;
            case "rightClick": await driver.actions({ async: true }).contextClick(await nestedWaiters.clickable()).perform(); break;
            case "doubleClick": await driver.actions({ async: true }).doubleClick(await nestedWaiters.clickable()).perform(); break;
            case "scrollTo": await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant',block:'center'});", await nestedWaiters.visible()); break;
            case "scroll": await driver.executeScript("window.scrollBy(0, arguments[0]);", Number(nested.scrollAmount ?? nested.ms ?? 600)); break;
            case "dragDrop": { const source = await nestedWaiters.visible(); const destBy = buildLocator(By, { strategy: nested.target2.strategy, value: substituteVariables(nested.target2.value, childVariables) }); const dest = await driver.wait(async()=>{try{const e=await driver.findElement(destBy);return await e.isDisplayed()?e:false}catch{return false}}, nestedTimeout, "Drag destination not visible", 200); await driver.actions({async:true}).dragAndDrop(source,dest).perform(); break; }
            case "uploadFile": { const file = path.resolve(substituteVariables(nested.filePath, childVariables)); await fs.access(file); await (await nestedWaiters.visible()).sendKeys(file); break; }
            case "extractText": { const value=await (await nestedWaiters.visible()).getText(); nestedRuntimeContext.lastText=value; childVariables[nested.outputName||"extractedText"]=value; await writeArtifact(`${safeOutputName(nested.outputName||`text-${childIndex+1}`)}.txt`,value,"text/plain; charset=utf-8"); break; }
            case "extractAttribute": { const value=String(await (await nestedWaiters.visible()).getAttribute(substituteVariables(nested.attribute,childVariables))??""); childVariables[nested.outputName||"extractedAttribute"]=value; await writeArtifact(`${safeOutputName(nested.outputName||`attribute-${childIndex+1}`)}.txt`,value,"text/plain; charset=utf-8"); break; }
            case "extractValue": { const el=await nestedWaiters.visible(); const value=String(await driver.executeScript("return arguments[0].value ?? '';",el)??""); childVariables[nested.outputName||"extractedValue"]=value; await writeArtifact(`${safeOutputName(nested.outputName||`value-${childIndex+1}`)}.txt`,value,"text/plain; charset=utf-8"); break; }
            case "extractTable": { const table=await nestedWaiters.visible(); const rows=await table.findElements(By.css("tr")); const values=[]; for(const row of rows){const cells=await row.findElements(By.css("th,td"));values.push(await Promise.all(cells.map(cell=>cell.getText())))} const csv=values.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n"); await writeArtifact(`${safeOutputName(nested.outputName||`table-${childIndex+1}`)}.csv`,csv,"text/csv; charset=utf-8"); childVariables[nested.outputName||"extractedTable"]=JSON.stringify(values); break; }
            case "saveText": await writeArtifact(`${safeOutputName(nested.outputName||`text-${childIndex+1}`)}.txt`,substituteVariables(nested.text||"",childVariables),"text/plain; charset=utf-8"); break;
            case "saveImage": { const el=await nestedWaiters.visible(); const image=await el.takeScreenshot(); await writeArtifact(`${safeOutputName(nested.outputName||`image-${childIndex+1}`)}.png`,Buffer.from(image,"base64"),"image/png"); break; }
            case "assertUrl": { const actual=await driver.getCurrentUrl(); const expected=substituteVariables(nested.expected||nested.url||"",childVariables); if(!actual.includes(expected)) throw new Error(`URL assertion failed: expected to contain ${expected}`); break; }
            case "assertExists": await nestedWaiters.locate(); break;
            case "assertCount": { const count=(await driver.findElements(nestedBy)).length; if(count!==Number(nested.expected)) throw new Error(`Element count assertion failed: expected ${nested.expected}, got ${count}`); break; }
            case "assertTitle": { const title=await driver.getTitle(); const expected=substituteVariables(nested.expected||"",childVariables); if(!title.includes(expected)) throw new Error(`Title assertion failed: expected to contain ${expected}`); break; }
            case "assertAttribute": { const actual=String(await (await nestedWaiters.visible()).getAttribute(substituteVariables(nested.attribute,childVariables))??""); const expected=substituteVariables(nested.expected||"",childVariables); if(actual!==expected) throw new Error(`Attribute assertion failed: ${actual} !== ${expected}`); break; }
            case "alertAccept": await driver.switchTo().alert().accept(); break;
            case "alertDismiss": await driver.switchTo().alert().dismiss(); break;
            case "openTab": { const url=substituteVariables(nested.url||"about:blank",childVariables); await driver.switchTo().newWindow("tab"); if(url!=="about:blank") { if(!isHttpUrl(url)) throw new Error("New tab URL must use http(s)"); await driver.get(url); } break; }
            case "closeTab": { await driver.close(); const hs=await driver.getAllWindowHandles(); if(!hs.length) throw new Error("No browser tabs remain"); await driver.switchTo().window(hs[0]); break; }
            case "switchWindow": { const hs=await driver.getAllWindowHandles(); const idx=Number(nested.ms||0); if(idx<0||idx>=hs.length) throw new Error("Requested browser tab index does not exist"); await driver.switchTo().window(hs[idx]); break; }
            case "switchFrame": await driver.switchTo().frame(await nestedWaiters.visible()); break;
            case "switchFrameDefault": await driver.switchTo().defaultContent(); break;
            case "waitDownload": { const start=Date.now(); let found=null; const expected=substituteVariables(nested.expected||nested.text||"",childVariables); while(Date.now()-start<nestedTimeout){for(const name of await fs.readdir(outputDirectory).catch(()=>[])){if(!name.endsWith(".crdownload")&&(!expected||name.includes(expected))){found=name;break}}if(found)break;await new Promise(r=>setTimeout(r,250))}if(!found)throw new Error("Timed out waiting for download"); break; }
            case "while": { if(!Array.isArray(nested.loopSteps))throw new Error("While loop needs nested steps"); const max=Math.max(1,Math.min(1000,Number(nested.repeatCount)||100)); const inlineId=`__nested_while_${Date.now()}_${childIndex}`; const lib=payload.workflowLibrary||(payload.workflowLibrary={}); lib[inlineId]={version:1,name:"Inline while",startUrl:"",browser:browserName,steps:nested.loopSteps,groups:[],variables:[]}; try{for(let r=0;r<max&&!stopRequested&&evaluateRuntimeCondition(nested.condition,nestedRuntimeContext);r++){childVariables.iteration=String(r+1);try{await executeNestedWorkflow(inlineId,depth+1,[...stack,workflowId],childVariables);nestedRuntimeContext.url=await driver.getCurrentUrl().catch(()=>nestedRuntimeContext.url)}catch(e){if(e&&e.flowControl==="break")break;if(e&&e.flowControl==="continue")continue;throw e}}}finally{delete lib[inlineId]}break; }
            case "breakLoop": { const error = new Error("Break loop requested."); error.flowControl = "break"; throw error; }
            case "continueLoop": { const error = new Error("Continue loop requested."); error.flowControl = "continue"; throw error; }
            case "ifElse": { const branch=evaluateRuntimeCondition(nested.condition,nestedRuntimeContext)?nested.thenSteps:nested.elseSteps; if(!Array.isArray(branch))throw new Error("If/else requires branch arrays"); const inlineId=`__nested_if_${Date.now()}_${childIndex}`; const lib=payload.workflowLibrary||(payload.workflowLibrary={}); lib[inlineId]={version:1,name:"Inline branch",startUrl:"",browser:browserName,steps:branch,groups:[],variables:[]}; try{await executeNestedWorkflow(inlineId,depth+1,[...stack,workflowId],childVariables)}finally{delete lib[inlineId]} break; }
            case "repeat": { if(!Array.isArray(nested.loopSteps))throw new Error("Repeat requires nested steps"); const count=Math.max(1,Math.min(1000,Number(nested.repeatCount)||1)); const inlineId=`__nested_repeat_${Date.now()}_${childIndex}`; const lib=payload.workflowLibrary||(payload.workflowLibrary={}); lib[inlineId]={version:1,name:"Inline repeat",startUrl:"",browser:browserName,steps:nested.loopSteps,groups:[],variables:[]}; try{for(let r=0;r<count&&!stopRequested;r++){childVariables.iteration=String(r+1);try{await executeNestedWorkflow(inlineId,depth+1,[...stack,workflowId],childVariables)}catch(e){if(e&&e.flowControl==="break")break;if(e&&e.flowControl==="continue")continue;throw e}}}finally{delete lib[inlineId]} break; }
            case "loopList": { if(!Array.isArray(nested.loopSteps))throw new Error("List loop requires nested steps");let items;const raw=substituteVariables(nested.listExpression||"",childVariables);try{const v=JSON.parse(raw);items=Array.isArray(v)?v:String(raw).split(",")}catch{items=String(raw).split(",")}if(items.length>1000)throw new Error("List loop max is 1000");const inlineId=`__nested_list_${Date.now()}_${childIndex}`;const lib=payload.workflowLibrary||(payload.workflowLibrary={});try{for(const item of items){childVariables[nested.itemVariable||"item"]=String(item);lib[inlineId]={version:1,name:"Inline list item",startUrl:"",browser:browserName,steps:nested.loopSteps,groups:[],variables:[]};try{await executeNestedWorkflow(inlineId,depth+1,[...stack,workflowId],childVariables)}catch(e){if(e&&e.flowControl==="break")break;if(e&&e.flowControl==="continue")continue;throw e}}}finally{delete lib[inlineId]}break; }
            case "userInput": { const values = await requestUserInput(nested, childIndex); for (const field of nested.inputs || []) { const value = String(values[field.id] ?? ""); if (field.required !== false && !value.trim()) throw new Error(`Input "${field.title}" is required.`); if (!value && field.required === false) continue; const fieldBy = buildLocator(By, { strategy: field.target.strategy, value: substituteVariables(field.target.value, childVariables) }); const el = await driver.wait(async()=>{try { const found=await driver.findElement(fieldBy); return await found.isDisplayed()?found:false;} catch{return false;}}, nestedTimeout, `Input target "${field.title}" did not become visible`, 200); await el.clear(); await el.sendKeys(value); } break; }
            case "back": await driver.navigate().back(); break;
            case "forward": await driver.navigate().forward(); break;
            case "refresh": await driver.navigate().refresh(); break;
            case "screenshot": { const image = await driver.takeScreenshot(); await writeArtifact(`${safeOutputName(nested.outputName || `sub-screenshot-${childIndex+1}`)}.png`, Buffer.from(image,"base64"), "image/png"); break; }
            default: throw new Error(`Unsupported nested action: ${nested.type}`);
          }
          }, nested.retry || {}, info => emit("subworkflow-step-retry", { workflowId, index: childIndex, name: nested.name || nested.type, ...info }));
          nestedRuntimeContext.stepStatus[nested.id || String(childIndex)] = "success";
          nestedRuntimeContext.url = await driver.getCurrentUrl().catch(() => nestedRuntimeContext.url);
          emit("subworkflow-step", { workflowId, index: childIndex, name: nested.name || nested.type, status: "success" });
        } catch (error) { nestedRuntimeContext.stepStatus[nested.id || String(childIndex)] = "error"; emit("subworkflow-step", { workflowId, index: childIndex, name: nested.name || nested.type, status: "error", error: normalizeError(error).message }); if (error && error.flowControl) throw error; if (nested.onError === "continue") continue; throw error; }
      }
      for (const [name, value] of Object.entries(childVariables)) inheritedVariables[name] = value;
      nestedRuntimeContext.url = await driver.getCurrentUrl().catch(() => nestedRuntimeContext.url);
      emit("subworkflow", { status: "success", workflowId, name: child.name || workflowId, depth });
    } catch (error) { emit("subworkflow", { status: "error", workflowId, name: child.name || workflowId, depth, error: normalizeError(error).message }); throw error; }
  };

  const quit = async () => {
    if (!driver) return;
    if (!quitPromise) quitPromise = driver.quit().catch(() => {});
    await quitPromise;
  };

  try {
    await fs.mkdir(outputDirectory, { recursive: true });
    if (driverFactory) {
      driver = await driverFactory({ browserName, payload });
    } else {
      const options = browserName === "edge" ? new edge.Options() : new chrome.Options();
      if (profile.userDataDir) {
        const userDataDir = String(profile.userDataDir).trim();
        if (userDataDir) options.addArguments(`--user-data-dir=${userDataDir}`);
      }
      const browserPrefs = {
        "download.default_directory": outputDirectory,
        "download.prompt_for_download": false,
        "download.directory_upgrade": true,
        "safebrowsing.enabled": true,
        ...(optimizations.disableImages ? { "profile.managed_default_content_settings.images": 2 } : {})
      };
      options.setUserPreferences(browserPrefs);
      const builder = new Builder().forBrowser(browserName === "edge" ? "MicrosoftEdge" : "chrome");
      if (optimizations.pageLoadStrategy !== "normal") builder.setCapability("pageLoadStrategy", optimizations.pageLoadStrategy);
      if (browserName === "edge") builder.setEdgeOptions(options);
      else builder.setChromeOptions(options);

      // Prefer a manually installed driver when present. This avoids Selenium Manager's
      // download path on machines where driver downloads are blocked (for example HTTP 403).
      const manualDriverPath = resolveDriverPath(browserName);
      if (manualDriverPath) {
        if (browserName === "edge") builder.setEdgeService(new edge.ServiceBuilder(manualDriverPath));
        else builder.setChromeService(new chrome.ServiceBuilder(manualDriverPath));
        emit("notice", { level: "info", message: `Using manually installed ${browserName === "edge" ? "EdgeDriver" : "ChromeDriver"}: ${manualDriverPath}` });
      }
      driver = await builder.build();
    }

    if (typeof process !== "undefined") process.once("SIGTERM", stop);
    const blockedPatterns = buildBlockedUrlPatterns(optimizations);
    if (blockedPatterns.length && typeof driver.sendDevToolsCommand === "function") {
      try {
        await driver.sendDevToolsCommand("Network.enable", {});
        await driver.sendDevToolsCommand("Network.setBlockedURLs", { urls: blockedPatterns });
        emit("optimization", { blockedResourceTypes: [
          ...(optimizations.disableImages ? ["images"] : []),
          ...(optimizations.disableCss ? ["css"] : []),
          ...(optimizations.disableFonts ? ["fonts"] : []),
          ...(optimizations.disableMedia ? ["media"] : [])
        ], blockedPatternCount: blockedPatterns.length });
      } catch (error) {
        emit("notice", { level: "warning", message: `Resource blocking is unavailable in this browser session: ${normalizeError(error).message}` });
      }
    } else if (blockedPatterns.length) {
      emit("notice", { level: "warning", message: "Resource blocking is unavailable for this driver; requested blocking settings were not applied." });
    }
    if (optimizations.disableCss) emit("notice", { level: "warning", message: "CSS requests are blocked for this run; page layout and controls may break." });
    if (payload.startUrl) await driver.get(substituteVariables(payload.startUrl, variables));

    // Optional persistent stdin control channel for live recorder commands.
    if (process.stdin && !process.stdin.destroyed) {
      let controlBuffer = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", async chunk => {
        controlBuffer += chunk;
        const lines = controlBuffer.split(/\r?\n/);
        controlBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let command;
          try { command = JSON.parse(line); } catch { emit("error", { message: "Invalid engine control JSON.", name: "SyntaxError" }); continue; }
          try {
            if (command.type === "user-input:response" || command.type === "user-input:cancel") {
              const pending = pendingUserInputs.get(command.requestId);
              if (pending) {
                pendingUserInputs.delete(command.requestId);
                if (command.type === "user-input:cancel") pending.reject(new Error("User cancelled the input dialog."));
                else if (!command.values || typeof command.values !== "object" || Array.isArray(command.values)) pending.reject(new Error("User input response is malformed."));
                else pending.resolve(command.values);
              }
            } else if (command.type === "recorder:start") {
              const bridgePath = path.join(__dirname, "recorder-bridge.js");
              const source = await fs.readFile(bridgePath, "utf8");
              await driver.executeScript(source);
              recording = true;
              lastRecorderMessage = null;
              emit("recorder", { status: "started", url: await driver.getCurrentUrl() });
            } else if (command.type === "recorder:stop") {
              await driver.executeScript("window.__flowforgeRecorderStateV1?.stop?.()");
              recording = false;
              if (recorderMode) stopRequested = true;
              emit("recorder", { status: "stopped" });
            } else if (command.type === "navigate") {
              if (!isHttpUrl(command.url)) throw new Error("Recorder navigation URL must use http or https.");
              await driver.get(command.url);
              if (recording) {
                const source = await fs.readFile(path.join(__dirname, "recorder-bridge.js"), "utf8");
                await driver.executeScript(source);
              }
              emit("recorder", { status: "navigated", url: await driver.getCurrentUrl() });
            } else if (command.type === "session:export") {
              const currentUrl = await driver.getCurrentUrl();
              const parsedUrl = new URL(currentUrl);
              if (!isHttpUrl(currentUrl)) throw new Error("Session export requires an HTTP(S) page.");
              const cookies = await driver.manage().getCookies();
              const storage = await driver.executeScript("return {localStorage:Object.entries(window.localStorage),sessionStorage:Object.entries(window.sessionStorage)};");
              const snapshot = { version: 1, createdAt: new Date().toISOString(), origin: parsedUrl.origin,
                cookies: cookies.map(c => ({ name:c.name, value:c.value, ...(c.domain?{domain:c.domain}:{}), ...(c.path?{path:c.path}:{}), ...(typeof c.expiry === "number"?{expiry:c.expiry}:{}), ...(typeof c.secure === "boolean"?{secure:c.secure}:{}), ...(typeof c.httpOnly === "boolean"?{httpOnly:c.httpOnly}:{}), ...(c.sameSite?{sameSite:c.sameSite}:{}) })),
                localStorage: storage.localStorage.map(([key,value])=>({key,value})), sessionStorage: storage.sessionStorage.map(([key,value])=>({key,value})) };
              emit("session-export", snapshot);
            } else if (command.type === "session:import") {
              const snapshot = command.snapshot;
              if (!snapshot || snapshot.version !== 1 || typeof snapshot.origin !== "string" || !isHttpUrl(snapshot.origin) || !Array.isArray(snapshot.cookies) || !Array.isArray(snapshot.localStorage) || !Array.isArray(snapshot.sessionStorage)) throw new Error("Malformed session snapshot.");
              if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > 2_000_000) throw new Error("Session snapshot exceeds the 2 MB limit.");
              const originUrl = new URL(snapshot.origin);
              await driver.get(originUrl.origin);
              const imported = { cookies: 0, expired: 0, rejected: 0, storageEntries: 0 };
              for (const cookie of snapshot.cookies) {
                try {
                  if (!cookie || typeof cookie.name !== "string" || typeof cookie.value !== "string") { imported.rejected++; continue; }
                  if (typeof cookie.expiry === "number" && cookie.expiry <= Math.floor(Date.now()/1000)) { imported.expired++; continue; }
                  const domain = typeof cookie.domain === "string" ? cookie.domain.replace(/^\./, "").toLowerCase() : originUrl.hostname.toLowerCase();
                  if (!(originUrl.hostname.toLowerCase() === domain || originUrl.hostname.toLowerCase().endsWith(`.${domain}`))) { imported.rejected++; continue; }
                  const clean = { name: cookie.name, value: cookie.value, path: typeof cookie.path === "string" ? cookie.path : "/", ...(cookie.domain ? { domain: cookie.domain } : {}), ...(typeof cookie.expiry === "number" ? { expiry: cookie.expiry } : {}), ...(typeof cookie.secure === "boolean" ? { secure: cookie.secure } : {}), ...(typeof cookie.httpOnly === "boolean" ? { httpOnly: cookie.httpOnly } : {}), ...( ["Strict","Lax","None"].includes(cookie.sameSite) ? { sameSite: cookie.sameSite } : {}) };
                  await driver.manage().addCookie(clean); imported.cookies++;
                } catch { imported.rejected++; }
              }
              await driver.executeScript("for (const [k,v] of arguments[0]) localStorage.setItem(k,v); for (const [k,v] of arguments[1]) sessionStorage.setItem(k,v);", snapshot.localStorage.map(x => [x.key, x.value]), snapshot.sessionStorage.map(x => [x.key, x.value]));
              imported.storageEntries = snapshot.localStorage.length + snapshot.sessionStorage.length;
              emit("session-import", imported);
            } else if (command.type === "stop") {
              stopRequested = true;
              emit("control", { status: "stop-requested" });
            } else {
              throw new Error(`Unsupported engine control command: ${String(command.type)}`);
            }
          } catch (error) {
            emit("error", { message: normalizeError(error).message, name: normalizeError(error).name, control: command.type });
          }
        }
      });
    }

    if (recorderMode) {
      const bridgeSource = await fs.readFile(path.join(__dirname, "recorder-bridge.js"), "utf8");
      await driver.executeScript(bridgeSource);
      recording = true;
      emit("recorder", { status: "started", url: await driver.getCurrentUrl() });
      while (!stopRequested) {
        await new Promise(resolve => setTimeout(resolve, 200));
        try {
          const message = await driver.executeScript("const m = window.__flowforgeRecorderLastMessage || null; window.__flowforgeRecorderLastMessage = null; return m;");
          if (message && message.channel === "FLOWFORGE_RECORDER_V1") {
            if (message.type === "selected" && message.data && typeof message.data.xpath === "string" && typeof message.data.css === "string") {
              emit("recorder", { status: "selected", selection: message.data });
              // Re-arm after each one-shot selection so recording can continue.
              if (!stopRequested) await driver.executeScript(bridgeSource);
            } else if (message.type === "stopped") {
              // Selection stop is one-shot; the bridge is rearmed by the polling loop after selection.
            }
          }
        } catch (error) {
          emit("notice", { level: "warning", message: `Recorder polling failed: ${normalizeError(error).message}` });
        }
      }
      emit("done", { success: true, recorder: true });
      return;
    }

    for (let index = 0; index < payload.steps.length; index++) {
      if (stopRequested) break;
      const step = payload.steps[index];
      const stepName = typeof step.name === "string" && step.name.trim() ? step.name : `${step.type} step`;
      if (step.disabled) {
        emit("step", { index, status: "skipped", name: stepName, reason: "disabled" });
        continue;
      }
      if (step.condition) {
        try {
          if (!evaluateRuntimeCondition(step.condition, runtimeContext)) {
            runtimeContext.stepStatus[step.id || String(index)] = "skipped";
            emit("step", { index, status: "skipped", name: stepName, reason: "condition-false" });
            continue;
          }
        } catch (conditionError) {
          emit("step", { index, status: "error", name: stepName, error: normalizeError(conditionError).message });
          if (step.onError !== "continue") throw conditionError;
          runtimeContext.stepStatus[step.id || String(index)] = "error";
          continue;
        }
      }
      const stepStarted = Date.now();
      emit("step", { index, status: "running", name: stepName, type: step.type });
      const timeout = asBoundedNumber(step.timeout, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, "Step timeout");
      // Some imported workflows keep an empty target object on non-element steps.
      // Only construct a Selenium locator for actions that actually use one.
      const by = stepRequiresLocator(step.type) ? buildLocator(By, {
        strategy: step.target.strategy,
        value: substituteVariables(step.target.value, variables)
      }) : null;
      // Re-query on every poll so dynamic pages can replace nodes while waiting.
      const { locate, visible, clickable } = createElementWaiters(driver, by, timeout, step.target ? `${step.target.strategy}=${step.target.value}` : "element");

      const executeStepAction = async () => {
        switch (step.type) {
          case "navigate": {
            const url = substituteVariables(step.url, variables);
            if (!isHttpUrl(url)) throw new Error("Navigation URL must use http or https.");
            await driver.get(url);
            runtimeContext.url = url;
            break;
          }
          case "click":
            await (await clickable()).click();
            break;
          case "type": {
            const element = await visible();
            if (step.clearFirst !== false) await element.clear();
            await element.sendKeys(substituteVariables(step.text ?? "", variables));
            break;
          }
          case "key": {
            const sequence = parseKeySequence(substituteVariables(step.key, variables), Key);
            const actions = driver.actions();
            let modifierDown = false;
            for (const key of sequence) {
              if ([Key.CONTROL, Key.SHIFT, Key.ALT, Key.COMMAND, Key.META].includes(key)) {
                actions.keyDown(key);
                modifierDown = true;
              } else {
                actions.sendKeys(key);
              }
            }
            if (modifierDown) {
              for (const key of sequence.filter(k => [Key.CONTROL, Key.SHIFT, Key.ALT, Key.COMMAND, Key.META].includes(k)).reverse()) {
                actions.keyUp(key);
              }
            }
            await actions.perform();
            break;
          }
          case "runWorkflow": {
            await executeNestedWorkflow(step.workflowId, 1, payload.currentWorkflowId ? [payload.currentWorkflowId] : [], variables);
            break;
          }
          case "userInput": {
            const values = await requestUserInput(step, index);
            for (const field of step.inputs) {
              const value = values[field.id] === undefined || values[field.id] === null ? "" : String(values[field.id]);
              if (field.required !== false && !value.trim()) throw new Error(`Input "${field.title}" is required.`);
              if (!value && field.required === false) continue;
              const fieldBy = buildLocator(By, { strategy: field.target.strategy, value: substituteVariables(field.target.value, variables) });
              const element = await driver.wait(async () => {
                try { const found = await driver.findElement(fieldBy); return await found.isDisplayed() ? found : false; } catch { return false; }
              }, timeout, `Input target "${field.title}" did not become visible within ${timeout}ms`, 200);
              await element.clear();
              await element.sendKeys(value);
            }
            break;
          }
          case "wait":
            await new Promise((resolve, reject) => {
              const duration = asBoundedNumber(step.ms, 1000, MAX_WAIT_MS, "Wait duration");
              const timer = setTimeout(resolve, duration);
              if (stopRequested) { clearTimeout(timer); reject(new Error("Automation stopped.")); }
            });
            break;
          case "waitVisible":
            await visible();
            break;
          case "waitClickable":
            await clickable();
            break;
          case "assertText": {
            const element = await visible();
            const actual = await element.getText();
            runtimeContext.lastText = actual;
            const expected = substituteVariables(step.expected ?? "", variables);
            if (!actual.includes(expected)) {
              throw new Error(`Text assertion failed. Expected to contain "${expected}", actual text was "${actual}".`);
            }
            break;
          }
          case "select": {
            const element = await clickable();
            const select = new Select(element);
            const value = substituteVariables(step.text ?? step.value ?? "", variables);
            await select.selectByValue(value);
            break;
          }
          case "hover": {
            const element = await visible(); await driver.actions({ async: true }).move({ origin: element }).perform(); break;
          }
          case "rightClick": {
            const element = await clickable(); await driver.actions({ async: true }).contextClick(element).perform(); break;
          }
          case "doubleClick": {
            const element = await clickable(); await driver.actions({ async: true }).doubleClick(element).perform(); break;
          }
          case "dragDrop": {
            const source = await visible(); const destinationBy = buildLocator(By, { strategy: step.target2.strategy, value: substituteVariables(step.target2.value, variables) });
            const destination = await driver.wait(async () => { try { const el = await driver.findElement(destinationBy); return await el.isDisplayed() ? el : false; } catch { return false; } }, timeout, "Drag destination did not become visible", 200);
            await driver.actions({ async: true }).dragAndDrop(source, destination).perform(); break;
          }
          case "scrollTo": { const element = await visible(); await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});", element); break; }
          case "scroll": { const amount = Math.max(-10000, Math.min(10000, Number(step.scrollAmount ?? step.ms ?? 600))); await driver.executeScript("window.scrollBy({top: arguments[0], left: 0, behavior: 'instant'});", amount); break; }
          case "uploadFile": { const file = path.resolve(substituteVariables(step.filePath, variables)); await fs.access(file); const element = await visible(); await element.sendKeys(file); break; }
          case "waitDownload": {
            const started = Date.now(); const limit = asBoundedNumber(step.timeout, 30000, 300000, "Download timeout"); const expected = substituteVariables(step.expected || step.text || "", variables);
            let completed = null;
            while (Date.now() - started < limit) {
              const files = await fs.readdir(outputDirectory).catch(() => []);
              let candidate = null;
              for (const name of files) {
                if (name.endsWith(".crdownload") || name.endsWith(".tmp") || name === "manifest.json" || outputArtifacts.some(artifact => artifact.name === name) || (expected && !name.includes(expected))) continue;
                if (await fs.stat(path.join(outputDirectory, name)).then(st => st.isFile(), () => false)) { candidate = name; break; }
              }
              if (candidate) { const full = path.join(outputDirectory, candidate); const stat = await fs.stat(full); if (stat.size > 100 * 1024 * 1024) throw new Error("Downloaded file exceeds the 100 MB output limit."); if (stat.size > 0) { completed = candidate; if (!outputArtifacts.some(a => a.name === completed)) { outputArtifacts.push({ name: completed, contentType: "application/octet-stream", size: stat.size, createdAt: new Date().toISOString() }); } break; } }
              await new Promise(resolve => setTimeout(resolve, 250));
            }
            if (!completed) throw new Error(`Download did not finish within ${limit}ms${expected ? ` for ${expected}` : ""}.`); emit("output-artifact", outputArtifacts.find(a => a.name === completed)); break;
          }
          case "extractText": {
            const value = await (await visible()).getText(); runtimeContext.lastText = value; const name = safeOutputName(step.outputName || `text-${index + 1}`);
            runtimeContext.variables[step.outputName || "extractedText"] = value; variables[step.outputName || "extractedText"] = value; await writeArtifact(name.endsWith(".txt") ? name : `${name}.txt`, value, "text/plain; charset=utf-8"); emit("extracted", { index, kind: "text", variable: step.outputName || "extractedText", length: value.length }); break;
          }
          case "extractAttribute": {
            const value = await (await visible()).getAttribute(substituteVariables(step.attribute, variables)); const actual = value ?? ""; runtimeContext.variables[step.outputName || "extractedAttribute"] = actual; variables[step.outputName || "extractedAttribute"] = actual;
            await writeArtifact(`${safeOutputName(step.outputName || `attribute-${index + 1}`)}.txt`, actual, "text/plain; charset=utf-8"); break;
          }
          case "extractValue": {
            const element = await visible(); const value = await driver.executeScript("return arguments[0].value ?? '';", element); const actual = String(value ?? "");
            runtimeContext.variables[step.outputName || "extractedValue"] = actual; variables[step.outputName || "extractedValue"] = actual; await writeArtifact(`${safeOutputName(step.outputName || `value-${index + 1}`)}.txt`, actual, "text/plain; charset=utf-8"); break;
          }
          case "extractTable": {
            const table = await visible(); const rows = await table.findElements(By.css("tr")); const values = [];
            for (const row of rows) { const cells = await row.findElements(By.css("th,td")); values.push(await Promise.all(cells.map(cell => cell.getText()))); }
            const csv = values.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
            await writeArtifact(`${safeOutputName(step.outputName || `table-${index + 1}`)}.csv`, csv, "text/csv; charset=utf-8"); runtimeContext.variables[step.outputName || "extractedTable"] = JSON.stringify(values); variables[step.outputName || "extractedTable"] = JSON.stringify(values); break;
          }
          case "saveText": { const text = substituteVariables(step.text || "", variables); await writeArtifact(`${safeOutputName(step.outputName || `text-${index + 1}`)}.txt`, text, "text/plain; charset=utf-8"); break; }
          case "saveImage": { const element = await visible(); let image; try { image = await element.takeScreenshot(); } catch { image = await driver.takeScreenshot(); }
            await writeArtifact(`${safeOutputName(step.outputName || `image-${index + 1}`)}.png`, Buffer.from(image, "base64"), "image/png"); break; }
          case "assertUrl": { const actual = await driver.getCurrentUrl(); const expected = substituteVariables(step.expected || step.url || "", variables); if (!actual.includes(expected)) throw new Error(`URL assertion failed: expected URL to contain "${expected}", got "${actual}".`); break; }
          case "assertExists": { await locate(); break; }
          case "assertCount": { const elements = await driver.findElements(by); const expected = Number(step.expected); if (!Number.isInteger(expected) || elements.length !== expected) throw new Error(`Element count assertion failed: expected ${step.expected}, got ${elements.length}.`); break; }
          case "assertTitle": { const actual = await driver.getTitle(); const expected = substituteVariables(step.expected || "", variables); if (!actual.includes(expected)) throw new Error(`Title assertion failed: expected title to contain "${expected}", got "${actual}".`); break; }
          case "assertAttribute": { const actual = await (await visible()).getAttribute(substituteVariables(step.attribute, variables)); const expected = substituteVariables(step.expected || "", variables); if (String(actual ?? "") !== expected) throw new Error(`Attribute assertion failed for ${step.attribute}: expected "${expected}", got "${actual ?? ""}".`); break; }
          case "alertAccept": await driver.switchTo().alert().accept(); break;
          case "alertDismiss": await driver.switchTo().alert().dismiss(); break;
          case "openTab": { const url = substituteVariables(step.url || "about:blank", variables); if (url !== "about:blank" && !isHttpUrl(url)) throw new Error("New tab URL must use http(s) or about:blank."); await driver.switchTo().newWindow("tab"); if (url !== "about:blank") await driver.get(url); break; }
          case "closeTab": { await driver.close(); const handles = await driver.getAllWindowHandles(); if (handles.length) await driver.switchTo().window(handles[0]); else throw new Error("No browser tabs remain open."); break; }
          case "switchWindow": { const handles = await driver.getAllWindowHandles(); const requested = Number(step.ms ?? 0); if (!Number.isInteger(requested) || requested < 0 || requested >= handles.length) throw new Error(`Tab index must be between 0 and ${Math.max(0, handles.length - 1)}.`); await driver.switchTo().window(handles[requested]); break; }
          case "switchFrame": { const frame = await visible(); await driver.switchTo().frame(frame); break; }
          case "switchFrameDefault": await driver.switchTo().defaultContent(); break;
          case "breakLoop": { const error = new Error("Break loop can only be used inside a loop block."); error.flowControl = "break"; throw error; }
          case "continueLoop": { const error = new Error("Continue loop can only be used inside a loop block."); error.flowControl = "continue"; throw error; }
          case "ifElse": {
            const passes = evaluateRuntimeCondition(step.condition, runtimeContext); const branch = passes ? step.thenSteps : step.elseSteps;
            if (!Array.isArray(branch)) throw new Error("If/else action needs an array of branch steps.");
            const inlineId = `__inline_${Date.now()}_${index}`; const library = payload.workflowLibrary || (payload.workflowLibrary = {});
            library[inlineId] = { version: 1, name: `${step.name || "If/else"} branch`, startUrl: "", browser: browserName, steps: branch, groups: [], variables: [] };
            try { await executeNestedWorkflow(inlineId, 1, payload.currentWorkflowId ? [payload.currentWorkflowId] : [], variables); } finally { delete library[inlineId]; }
            emit("control-flow", { type: "ifElse", branch: passes ? "then" : "else", index }); break;
          }
          case "repeat": {
            const count = Math.max(1, Math.min(1000, Math.floor(Number(step.repeatCount) || 1))); if (!Array.isArray(step.loopSteps)) throw new Error("Repeat action needs loopSteps.");
            const inlineId = `__repeat_${Date.now()}_${index}`; const library = payload.workflowLibrary || (payload.workflowLibrary = {});
            library[inlineId] = { version: 1, name: `${step.name || "Repeat"} iteration`, startUrl: "", browser: browserName, steps: step.loopSteps, groups: [], variables: [] };
            try { for (let iteration = 0; iteration < count && !stopRequested; iteration++) { runtimeContext.variables.iteration = String(iteration + 1); try { await executeNestedWorkflow(inlineId, 1, payload.currentWorkflowId ? [payload.currentWorkflowId] : [], runtimeContext.variables); } catch (error) { if (error && error.flowControl === "break") break; if (error && error.flowControl === "continue") continue; throw error; } } } finally { delete library[inlineId]; }
            break;
          }
          case "loopList": {
            if (!Array.isArray(step.loopSteps)) throw new Error("Loop over list needs loopSteps."); const rawList = substituteVariables(step.listExpression || "", variables); let items;
            try { const parsed = JSON.parse(rawList); items = Array.isArray(parsed) ? parsed : String(rawList).split(","); } catch { items = String(rawList).split(","); }
            if (items.length > 1000) throw new Error("Loop list is limited to 1000 items."); const inlineId = `__list_${Date.now()}_${index}`; const library = payload.workflowLibrary || (payload.workflowLibrary = {});
            try { for (let itemIndex = 0; itemIndex < items.length && !stopRequested; itemIndex++) { const item = items[itemIndex]; runtimeContext.variables[step.itemVariable || "item"] = String(item); library[inlineId] = { version: 1, name: `${step.name || "List loop"} item`, startUrl: "", browser: browserName, steps: step.loopSteps, groups: [], variables: [] }; try { await executeNestedWorkflow(inlineId, 1, payload.currentWorkflowId ? [payload.currentWorkflowId] : [], runtimeContext.variables); } catch (error) { if (error && error.flowControl === "break") break; if (error && error.flowControl === "continue") continue; throw error; } } } finally { delete library[inlineId]; } break;
          }
          case "while": {
            if (!Array.isArray(step.loopSteps)) throw new Error("While loop needs nested steps."); const max = Math.max(1, Math.min(1000, Number(step.repeatCount) || 100)); const inlineId = `__while_${Date.now()}_${index}`; const library = payload.workflowLibrary || (payload.workflowLibrary = {});
            library[inlineId] = { version: 1, name: `${step.name || "While"} iteration`, startUrl: "", browser: browserName, steps: step.loopSteps, groups: [], variables: [] };
            try { for (let iteration = 0; iteration < max && !stopRequested && evaluateRuntimeCondition(step.condition, runtimeContext); iteration++) { runtimeContext.variables.iteration = String(iteration + 1); try { await executeNestedWorkflow(inlineId, 1, payload.currentWorkflowId ? [payload.currentWorkflowId] : [], runtimeContext.variables); runtimeContext.url = await driver.getCurrentUrl().catch(() => runtimeContext.url); } catch (error) { if (error && error.flowControl === "break") break; if (error && error.flowControl === "continue") continue; throw error; } } } finally { delete library[inlineId]; } break;
          }
          case "screenshot": {
            const image = await driver.takeScreenshot();
            const requested = typeof step.outputName === "string" ? safeOutputName(step.outputName) : `screenshot-${index + 1}`;
            const filename = requested.toLowerCase().endsWith(".png") ? requested : `${requested}.png`;
            const outputPath = await writeArtifact(filename, Buffer.from(image, "base64"), "image/png");
            emit("screenshot", { index, path: outputPath });
            break;
          }
          case "back":
            await driver.navigate().back();
            break;
          case "forward":
            await driver.navigate().forward();
            break;
          case "refresh":
            await driver.navigate().refresh();
            break;
          default:
            throw new Error(`Unsupported step type: ${step.type}`);
        }
      };
      const retryConfig = step.retry && typeof step.retry === "object" ? step.retry : {};
      const maxAttempts = Math.max(1, Math.min(10, Math.floor(Number(retryConfig.attempts || 1)) || 1));
      const retryDelayMs = Math.max(0, Math.min(30_000, Math.floor(Number(retryConfig.delayMs || 0)) || 0));
      let actionError = null;
      try {
        await runWithRetry(executeStepAction, { attempts: maxAttempts, delayMs: retryDelayMs }, info => {
          emit("step-retry", { index, name: stepName, ...info, maxAttempts });
        });
      } catch (error) { actionError = error; }
      if (actionError) {
        const normalized = normalizeError(actionError);
        runtimeContext.stepStatus[step.id || String(index)] = "error";
        emit("step", { index, status: "error", name: stepName, error: normalized.message, errorName: normalized.name, attempts: maxAttempts, durationMs: Date.now() - stepStarted });
        if (step.onError !== "continue") throw actionError;
      } else {
        runtimeContext.stepStatus[step.id || String(index)] = "success";
        try { runtimeContext.url = await driver.getCurrentUrl(); } catch {}
        emit("step", { index, status: "success", name: stepName, attempts: maxAttempts, durationMs: Date.now() - stepStarted });
      }
    }
    try {
      const metrics = await driver.executeScript(`
        const nav = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        return {
          url: location.href,
          resourceCount: resources.length,
          transferBytes: resources.reduce((sum, item) => sum + (Number(item.transferSize) || 0), 0),
          navigationDurationMs: nav ? Math.round(nav.duration) : null,
          domContentLoadedMs: nav && nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
          loadEventMs: nav && nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null
        };
      `);
      emit("performance", { totalDurationMs: Date.now() - runStarted, ...metrics });
    } catch (metricsError) {
      emit("performance", { totalDurationMs: Date.now() - runStarted, metricsUnavailable: normalizeError(metricsError).message });
    }
    if (stopRequested) emit("done", { success: false, stopped: true });
    else emit("done", { success: true });
  } catch (error) {
    const normalized = normalizeError(error);
    emit("error", { ...normalized, stack: error instanceof Error ? error.stack : undefined });
    process.exitCode = 1;
  } finally {
    await quit();
    try {
      await fs.mkdir(outputDirectory, { recursive: true });
      const knownArtifacts = new Set(outputArtifacts.map(item => item.name));
      for (const name of await fs.readdir(outputDirectory).catch(() => [])) {
        if (name === "manifest.json" || name.endsWith(".crdownload") || name.endsWith(".tmp") || knownArtifacts.has(name)) continue;
        const artifactPath = path.join(outputDirectory, name);
        const stat = await fs.stat(artifactPath).catch(() => null);
        if (!stat || !stat.isFile()) continue;
        if (stat.size > 100 * 1024 * 1024) { await fs.unlink(artifactPath).catch(() => {}); emit("notice", { level: "warning", message: `Output file ${name} exceeded the 100 MB limit and was excluded from the run archive.` }); continue; }
        const ext = path.extname(name).toLowerCase();
        const contentType = ({ ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf" })[ext] || "application/octet-stream";
        outputArtifacts.push({ name, contentType, size: stat.size, createdAt: stat.mtime.toISOString() });
      }
      const manifest = { workflowId: payload.currentWorkflowId || null, workflowName: payload.workflowName || "Workflow", runId: payload.runId || path.basename(outputDirectory), createdAt: new Date().toISOString(), artifacts: outputArtifacts };
      await fs.writeFile(path.join(outputDirectory, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
      if (outputArchivePath) {
        const { createZipFromDirectory } = require("./zip.cjs");
        const archived = await createZipFromDirectory(outputDirectory, outputArchivePath);
        if (outputManifestPath) await fs.writeFile(outputManifestPath, JSON.stringify({ ...manifest, archiveName: path.basename(outputArchivePath), archivePath: outputArchivePath, archiveSize: (await fs.stat(outputArchivePath)).size, fileCount: archived.fileCount }, null, 2), "utf8");
        emit("output-archive", { path: outputArchivePath, name: path.basename(outputArchivePath), workflowId: payload.currentWorkflowId || null, workflowName: payload.workflowName || "Workflow", fileCount: archived.fileCount, artifacts: outputArtifacts });
      }
    } catch (outputError) { emit("notice", { level: "warning", message: `Could not package workflow outputs: ${normalizeError(outputError).message}` }); }
    if (typeof process !== "undefined") process.removeListener("SIGTERM", stop);
  }
}

if (require.main === module) {
  (async () => {
    let payload;
    const payloadPath = process.env.FLOWFORGE_PAYLOAD_FILE;
    try {
      const raw = payloadPath ? await fs.readFile(payloadPath, "utf8") : (process.env.FLOWFORGE_PAYLOAD || "{}");
      payload = JSON.parse(raw);
    } catch (error) {
      emit("error", { message: `Workflow payload could not be read or parsed: ${normalizeError(error).message}`, name: "SyntaxError" });
      process.exitCode = 1;
    } finally {
      if (payloadPath) await fs.unlink(payloadPath).catch(() => {});
    }
    if (payload) runWorkflow(payload).catch(error => {
      emit("error", normalizeError(error));
      process.exitCode = 1;
    });
  })();
}

module.exports = {
  DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, MAX_WAIT_MS, isHttpUrl,
  asBoundedNumber, validatePayload, substituteVariables, buildLocator, stepRequiresLocator, createElementWaiters,
  parseKeySequence, normalizeError, runWithRetry, normalizeOptimizations, buildBlockedUrlPatterns, resolveDriverPath, runWorkflow
};
