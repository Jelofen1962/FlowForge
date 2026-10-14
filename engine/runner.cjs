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
    if (step.type === "wait") asBoundedNumber(step.ms, 1000, MAX_WAIT_MS, `Step ${i + 1} wait duration`);
    if (["click", "type", "waitVisible", "waitClickable", "assertText", "select"].includes(step.type)) {
      if (!step.target || !LOCATOR_NAMES.has(step.target.strategy) || typeof step.target.value !== "string" || !step.target.value.trim()) {
        throw new Error(`Step ${i + 1} (${step.type}) needs a supported locator and a non-empty locator value.`);
      }
    }
    if (step.type === "navigate" && !isHttpUrl(step.url)) throw new Error(`Step ${i + 1} needs a valid http(s) URL.`);
    if (step.type === "key" && (typeof step.key !== "string" || !step.key.trim())) throw new Error(`Step ${i + 1} needs a key or shortcut.`);
  }
  return { ...payload, browser };
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
  const optimizations = payload.optimizations || {};
  const variables = Object.fromEntries((payload.variables || []).map(v => [v.name, v.value]));
  let driver;
  let stopRequested = false;
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
      if (browserName === "edge") builder.setEdgeOptions(options);
      else builder.setChromeOptions(options);
      driver = await builder.build();
    }

    if (typeof process !== "undefined") process.once("SIGTERM", stop);
    if (payload.startUrl) await driver.get(substituteVariables(payload.startUrl, variables));

    if (optimizations.disableCss) {
      try {
        await driver.sendDevToolsCommand("Network.enable", {});
        await driver.sendDevToolsCommand("Network.setBlockedURLs", { urls: ["*.css", "*.css?*"] });
        emit("notice", { level: "warning", message: "CSS requests are blocked for this run; page layout and controls may break." });
      } catch (error) {
        emit("notice", { level: "warning", message: `CSS blocking is unavailable in this browser session: ${normalizeError(error).message}` });
      }
    }

    for (let index = 0; index < payload.steps.length; index++) {
      if (stopRequested) break;
      const step = payload.steps[index];
      const stepName = typeof step.name === "string" && step.name.trim() ? step.name : `${step.type} step`;
      if (step.disabled) {
        emit("step", { index, status: "skipped", name: stepName, reason: "disabled" });
        continue;
      }
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

      try {
        switch (step.type) {
          case "navigate": {
            const url = substituteVariables(step.url, variables);
            if (!isHttpUrl(url)) throw new Error("Navigation URL must use http or https.");
            await driver.get(url);
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
        emit("step", { index, status: "success", name: stepName });
      } catch (error) {
        const normalized = normalizeError(error);
        emit("step", { index, status: "error", name: stepName, error: normalized.message, errorName: normalized.name });
        if (step.onError !== "continue") throw error;
      }
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
  parseKeySequence, normalizeError, runWorkflow
};
