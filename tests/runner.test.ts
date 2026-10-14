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
};

const Key = {
  CONTROL: "CTRL", SHIFT: "SHIFT", ALT: "ALT", COMMAND: "CMD", META: "META",
  ENTER: "ENTER", ESC: "ESC", TAB: "TAB", SPACE: "SPACE", BACK_SPACE: "BACKSPACE",
  DELETE: "DELETE", ARROW_UP: "UP", ARROW_DOWN: "DOWN", ARROW_LEFT: "LEFT",
  ARROW_RIGHT: "RIGHT", HOME: "HOME", END: "END", PAGE_UP: "PAGEUP", PAGE_DOWN: "PAGEDOWN"
};

describe("Selenium runner validation", () => {
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
