import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const runner = require("../engine/runner.cjs") as {
  isHttpUrl: (value: string) => boolean;
  asBoundedNumber: (value: unknown, fallback: number, max: number, label: string) => number;
  validatePayload: (payload: unknown) => { browser: string; steps: unknown[] };
  substituteVariables: (value: string, variables?: Record<string, unknown>) => string;
  parseKeySequence: (value: string, Key: Record<string, string>) => string[];
  runWithRetry: (action: () => Promise<unknown>, options?: { attempts?: number; delayMs?: number }, onRetry?: (info: Record<string, unknown>) => void) => Promise<unknown>;
  normalizeOptimizations: (value?: Record<string, unknown>) => { disableImages:boolean; disableCss:boolean; disableFonts:boolean; disableMedia:boolean; pageLoadStrategy:string };
  buildBlockedUrlPatterns: (value?: Record<string, unknown>) => string[];
  stepRequiresLocator: (stepType: string) => boolean;
  createElementWaiters: (driver: any, by: unknown, timeout: number, description?: string) => { locate: () => Promise<any>; visible: () => Promise<any>; clickable: () => Promise<any> };
  resolveDriverPath: (browserName: string, env?: Record<string, string>, existsSync?: (path: string) => boolean, platform?: string) => string | null;
};

const Key = {
  CONTROL: "CTRL", SHIFT: "SHIFT", ALT: "ALT", COMMAND: "CMD", META: "META",
  ENTER: "ENTER", ESC: "ESC", TAB: "TAB", SPACE: "SPACE", BACK_SPACE: "BACKSPACE",
  DELETE: "DELETE", ARROW_UP: "UP", ARROW_DOWN: "DOWN", ARROW_LEFT: "LEFT",
  ARROW_RIGHT: "RIGHT", HOME: "HOME", END: "END", PAGE_UP: "PAGEUP", PAGE_DOWN: "PAGEDOWN"
};

describe("Selenium runner validation", () => {
  it("requires locators only for element actions, not navigation or timed waits", () => {
    expect(runner.stepRequiresLocator("click")).toBe(true);
    expect(runner.stepRequiresLocator("type")).toBe(true);
    expect(runner.stepRequiresLocator("navigate")).toBe(false);
    expect(runner.stepRequiresLocator("wait")).toBe(false);
    expect(runner.validatePayload({ steps: [
      { type: "navigate", url: "https://parinsanat.com/", target: { strategy: "xpath", value: "" } },
      { type: "wait", ms: 1000, target: { strategy: "xpath", value: "" } }
    ] }).steps).toHaveLength(2);
  });
  it("prefers the configured or default Windows ChromeDriver path when it exists", () => {
    const expected = "C:\\WebDriver\\chromedriver\\chromedriver.exe";
    expect(runner.resolveDriverPath("chrome", {}, path => path === expected, "win32")).toBe(expected);
    expect(runner.resolveDriverPath("chrome", { FLOWFORGE_CHROMEDRIVER_PATH: "D:\\drivers\\chrome.exe" }, path => path.startsWith("D:"), "win32")).toBe("D:\\drivers\\chrome.exe");
    expect(runner.resolveDriverPath("chrome", {}, () => false, "win32")).toBeNull();
  });

  it("accepts only absolute HTTP and HTTPS URLs", () => {
    expect(runner.isHttpUrl("https://example.com")).toBe(true);
    expect(runner.isHttpUrl("http://localhost:3000/a")).toBe(true);
    expect(runner.isHttpUrl("file:///tmp/a")).toBe(false);
    expect(runner.isHttpUrl("not a url")).toBe(false);
  });

  it("bounds timeouts and rejects negative/non-numeric values", () => {
    expect(runner.asBoundedNumber(undefined, 10_000, 120_000, "timeout")).toBe(10_000);
    expect(runner.asBoundedNumber(999_999, 10_000, 120_000, "timeout")).toBe(120_000);
    expect(() => runner.asBoundedNumber(-1, 10, 100, "timeout")).toThrow(/non-negative/);
    expect(() => runner.asBoundedNumber("many", 10, 100, "timeout")).toThrow(/non-negative/);
  });

  it("rejects malformed payloads and missing locators before opening a browser", () => {
    expect(() => runner.validatePayload(null)).toThrow(/object/);
    expect(() => runner.validatePayload({ steps: [{ type: "click" }] })).toThrow(/locator/);
    expect(() => runner.validatePayload({ steps: [{ type: "navigate", url: "file:///etc/passwd" }] })).toThrow(/http\(s\)/);
    expect(() => runner.validatePayload({ steps: [], browser: "firefox" })).toThrow(/Unsupported browser/);
  });

  it("wait-until methods re-query dynamic elements and require visible/enabled state", async () => {
    let lookups = 0;
    const element = { isDisplayed: async () => true, isEnabled: async () => true };
    const fakeDriver = { findElement: async () => { lookups++; return element; }, wait: async (condition: () => Promise<any>) => condition() };
    const waits = runner.createElementWaiters(fakeDriver, { selector: "#submit" }, 100, "css=#submit");
    expect(await waits.visible()).toBe(element);
    expect(await waits.clickable()).toBe(element);
    expect(lookups).toBe(2);
  });

  it("validates user input fields and their destination locators", () => {
    const validInput = { type: "userInput", name: "Ask for details", inputs: [
      { id: "email", title: "Email address", required: true, secret: false, target: { strategy: "css", value: "#email" } },
      { id: "password", title: "Password", required: true, secret: true, target: { strategy: "id", value: "password" } }
    ] };
    expect(runner.validatePayload({ steps: [validInput] }).steps).toHaveLength(1);
    expect(() => runner.validatePayload({ steps: [{ ...validInput, inputs: [{ id: "email", title: "Email", target: { strategy: "css", value: " " } }] }] })).toThrow(/target locator/i);
    expect(() => runner.validatePayload({ steps: [{ ...validInput, inputs: [] }] })).toThrow(/between 1 and 30/i);
  });


  it("validates workflow-call references against the supplied workflow library", () => {
    const child = { version: 1, name: "Child", startUrl: "https://example.com", browser: "chrome", steps: [{ type: "navigate", url: "https://example.com" }], groups: [], variables: [] };
    expect(runner.validatePayload({ steps: [{ type: "runWorkflow", workflowId: "child" }], workflowLibrary: { child } }).steps).toHaveLength(1);
    expect(() => runner.validatePayload({ steps: [{ type: "runWorkflow", workflowId: "missing" }], workflowLibrary: {} })).toThrow(/not in the supplied library/i);
    expect(() => runner.validatePayload({ steps: [{ type: "runWorkflow", workflowId: "" }], workflowLibrary: { child } })).toThrow(/select a workflow/i);
  });

  it("accepts a valid click workflow and normalizes browser choice", () => {
    const result = runner.validatePayload({
      browser: "edge",
      startUrl: "https://example.com",
      steps: [{ type: "click", target: { strategy: "css", value: "button.go" } }]
    });
    expect(result.browser).toBe("edge");
    expect(result.steps).toHaveLength(1);
  });

  it("substitutes declared variables and rejects missing variables", () => {
    expect(runner.substituteVariables("hello ${user}", { user: "Ada" })).toBe("hello Ada");
    expect(() => runner.substituteVariables("${missing}", {})).toThrow(/Unknown workflow variable/);
  });

  it("retries transient action failures and reports each retry", async () => {
    let attempts = 0;
    const retries: Record<string, unknown>[] = [];
    const result = await runner.runWithRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error("temporary failure");
      return "recovered";
    }, { attempts: 3, delayMs: 0 }, info => retries.push(info));
    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
    expect(retries).toHaveLength(2);
    await expect(runner.runWithRetry(async () => { throw new Error("permanent"); }, { attempts: 2, delayMs: 0 })).rejects.toThrow("permanent");
  });

  it("rejects unsafe retry configuration", () => {
    expect(() => runner.validatePayload({ steps: [{ type: "wait", retry: { attempts: 99, delayMs: 0 } }] })).toThrow(/retry attempts/i);
    expect(() => runner.validatePayload({ steps: [{ type: "wait", retry: { attempts: 2, delayMs: 30001 } }] })).toThrow(/retry delay/i);
  });

  it("parses modifier shortcuts and named keys", () => {
    expect(runner.parseKeySequence("CTRL+A", Key)).toEqual(["CTRL", "A"]);
    expect(runner.parseKeySequence("SHIFT+ENTER", Key)).toEqual(["SHIFT", "ENTER"]);
    expect(() => runner.parseKeySequence("NOT_A_KEY", Key)).toThrow(/Unsupported key/);
  });
});


describe("browser optimization configuration", () => {
  it("normalizes optimization flags and defaults to normal page loading", () => {
    expect(runner.normalizeOptimizations()).toEqual({ disableImages:false, disableCss:false, disableFonts:false, disableMedia:false, pageLoadStrategy:"normal", headless:false });
    expect(runner.normalizeOptimizations({ disableFonts:true, pageLoadStrategy:"eager" }).disableFonts).toBe(true);
    expect(runner.normalizeOptimizations({ headless:true }).headless).toBe(true);
    expect(runner.normalizeOptimizations({ headless:false }).headless).toBe(false);
  });
  it("rejects invalid optimization values", () => {
    expect(() => runner.normalizeOptimizations({ pageLoadStrategy:"instant" })).toThrow(/page load strategy/i);
    expect(() => runner.normalizeOptimizations({ disableImages:"yes" })).toThrow(/boolean/i);
  });
  it("builds resource blocking patterns only for enabled categories", () => {
    expect(runner.buildBlockedUrlPatterns({ disableFonts:true })).toContain("*.woff2");
    expect(runner.buildBlockedUrlPatterns({ disableMedia:true })).toContain("*.mp4");
    expect(runner.buildBlockedUrlPatterns({ disableCss:true })).toContain("*.css");
    expect(runner.buildBlockedUrlPatterns({})).toEqual([]);
  });
});

describe("standard regular-expression support", () => {
  it("supports standard JavaScript flags and slash-delimited literals", () => {
    const { compileWorkflowRegex } = require("../engine/runner.cjs");
    expect("ABC".replace(compileWorkflowRegex("abc", "gi"), "x")).toBe("x");
    expect("a\nb".replace(compileWorkflowRegex("/a.b/s", ""), "x")).toBe("x");
    expect("one one".replace(compileWorkflowRegex("one", "gy"), "x")).toBe("x one");
    expect(compileWorkflowRegex("[\\s\\S]*", "g").test("a\nb")).toBe(true);
  });

  it("rejects invalid patterns and unsupported flags with actionable messages", () => {
    const { compileWorkflowRegex } = require("../engine/runner.cjs");
    expect(() => compileWorkflowRegex("[", "g")).toThrow(/Invalid regular expression/);
    expect(() => compileWorkflowRegex("abc", "z")).toThrow(/Unsupported regular-expression flags/);
  });
});
