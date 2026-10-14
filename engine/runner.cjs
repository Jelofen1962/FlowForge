/**
 * FlowForge Selenium runner.
 * Protocol: one JSON object per stdout line. Diagnostic text is never written to stdout.
 */
"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_WAIT_MS = 300_000;

const LOCATOR_NAMES = new Set(["xpath", "css", "id", "name", "linkText", "className", "tagName"]);
const STEP_TYPES = new Set([
  "click", "type", "key", "navigate", "waitVisible", "waitClickable", "wait",
  "assertText", "select", "screenshot", "back", "forward", "refresh"
]);

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

function validatePayload(payload) {
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
    if (["click", "type", "waitVisible", "waitClickable", "assertText", "select"].includes(step.type)) {
      if (!step.target || !LOCATOR_NAMES.has(step.target.strategy) || typeof step.target.value !== "string" || !step.target.value.trim()) {
        throw new Error(`Step ${i + 1} (${step.type}) needs a supported locator and a non-empty locator value.`);
      }
    }
    if (step.type === "navigate" && !isHttpUrl(step.url)) throw new Error(`Step ${i + 1} needs a valid http(s) URL.`);
    if (step.type === "key" && (typeof step.key !== "string" || !step.key.trim())) throw new Error(`Step ${i + 1} needs a key or shortcut.`);
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
  const runtimeContext = { variables: Object.fromEntries((payload.variables || []).map(v => [v.name, String(v.value ?? "")])), lastText: "", url: payload.startUrl || "", stepStatus: {} };
  let recorderMode = payload.mode === "recorder";
  let lastRecorderMessage = null;
  let quitPromise;

  const stop = () => { stopRequested = true; };
  const quit = async () => {
    if (!driver) return;
    if (!quitPromise) quitPromise = driver.quit().catch(() => {});
    await quitPromise;
  };

  try {
    if (driverFactory) {
      driver = await driverFactory({ browserName, payload });
    } else {
      const options = browserName === "edge" ? new edge.Options() : new chrome.Options();
      if (profile.userDataDir) {
        const userDataDir = String(profile.userDataDir).trim();
        if (userDataDir) options.addArguments(`--user-data-dir=${userDataDir}`);
      }
      if (optimizations.disableImages) {
        options.setUserPreferences({ "profile.managed_default_content_settings.images": 2 });
      }
      const builder = new Builder().forBrowser(browserName === "edge" ? "MicrosoftEdge" : "chrome");
      if (optimizations.pageLoadStrategy !== "normal") builder.setCapability("pageLoadStrategy", optimizations.pageLoadStrategy);
      if (browserName === "edge") builder.setEdgeOptions(options);
      else builder.setChromeOptions(options);
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
            if (command.type === "recorder:start") {
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
      const by = step.target ? buildLocator(By, {
        strategy: step.target.strategy,
        value: substituteVariables(step.target.value, variables)
      }) : null;
      const locate = () => driver.wait(until.elementLocated(by), timeout, `Timed out after ${timeout}ms locating ${step.target?.strategy}=${step.target?.value}`, 200);
      const visible = async () => {
        const element = await locate();
        await driver.wait(until.elementIsVisible(element), timeout, `Element did not become visible within ${timeout}ms`, 200);
        return element;
      };
      const clickable = async () => {
        const element = await visible();
        await driver.wait(until.elementIsEnabled(element), timeout, `Element did not become enabled within ${timeout}ms`, 200);
        return element;
      };

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
          case "screenshot": {
            const image = await driver.takeScreenshot();
            const outputDir = path.resolve(payload.screenshotDirectory || process.cwd());
            await fs.mkdir(outputDir, { recursive: true });
            const requested = typeof step.path === "string" ? path.basename(step.path) : "";
            const filename = requested && requested.toLowerCase().endsWith(".png")
              ? requested : `flowforge-${new Date().toISOString().replace(/[:.]/g, "-")}-${index + 1}.png`;
            const outputPath = path.join(outputDir, filename);
            await fs.writeFile(outputPath, image, "base64");
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
    if (typeof process !== "undefined") process.removeListener("SIGTERM", stop);
  }
}

if (require.main === module) {
  let payload;
  try {
    payload = JSON.parse(process.env.FLOWFORGE_PAYLOAD || "{}");
  } catch {
    emit("error", { message: "FLOWFORGE_PAYLOAD is not valid JSON.", name: "SyntaxError" });
    process.exitCode = 1;
  }
  if (payload) runWorkflow(payload).catch(error => {
    emit("error", normalizeError(error));
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, MAX_WAIT_MS, isHttpUrl,
  asBoundedNumber, validatePayload, substituteVariables, buildLocator,
  parseKeySequence, normalizeError, runWithRetry, normalizeOptimizations, buildBlockedUrlPatterns, runWorkflow
};
