import { describe, expect, it } from "vitest";
import {
  evaluateCondition, validateControlFlow, withRetry, runCountedLoop,
  createExecutionRecord, finishExecutionRecord, type RuntimeContext
} from "../src/core/controlFlow";

const context: RuntimeContext = {
  variables: { count: "4", user: "Ada", enabled: "true" },
  lastText: "Welcome back, Ada",
  url: "https://example.com/account",
  stepStatus: { "step-1": "success", "step-2": "error" }
};

describe("control flow conditions", () => {
  it("evaluates strings, numeric comparisons, and truthiness", () => {
    expect(evaluateCondition({ source:"variable", key:"user", operator:"equals", expected:"Ada" }, context)).toBe(true);
    expect(evaluateCondition({ source:"lastText", operator:"contains", expected:"Welcome" }, context)).toBe(true);
    expect(evaluateCondition({ source:"variable", key:"count", operator:"greaterThan", expected:"3" }, context)).toBe(true);
    expect(evaluateCondition({ source:"variable", key:"enabled", operator:"truthy" }, context)).toBe(true);
    expect(evaluateCondition({ source:"url", operator:"contains", expected:"/account" }, context)).toBe(true);
    expect(evaluateCondition({ source:"stepStatus", key:"step-2", operator:"equals", expected:"error" }, context)).toBe(true);
  });

  it("fails closed for unknown variables and malformed regular expressions", () => {
    expect(() => evaluateCondition({ source:"variable", key:"missing", operator:"equals", expected:"x" }, context)).toThrow(/unknown variable/i);
    expect(() => evaluateCondition({ source:"lastText", operator:"matches", expected:"[" }, context)).toThrow(/regular expression/i);
  });

  it("validates loop and retry limits", () => {
    expect(validateControlFlow({ loop:{ mode:"count", count:3 } })).toEqual([]);
    expect(validateControlFlow({ loop:{ mode:"count", count:10001 } }).length).toBeGreaterThan(0);
    expect(validateControlFlow({ retry:{ attempts:11, delayMs:0 } }).length).toBeGreaterThan(0);
  });

  it("runs a counted loop exactly the requested number of times", async () => {
    const values = await runCountedLoop(3, 10, async n => n * 2);
    expect(values).toEqual([2,4,6]);
    await expect(runCountedLoop(3, 2, async n => n)).rejects.toThrow(/exceeds/);
  });

  it("retries transient failures up to the configured attempt count", async () => {
    let count = 0;
    const value = await withRetry(async () => {
      count++;
      if (count < 3) throw new Error("temporary");
      return "ok";
    }, { attempts:3, delayMs:0 });
    expect(value).toBe("ok");
    expect(count).toBe(3);
  });

  it("records execution duration and result", () => {
    const record = createExecutionRecord("step-1", 0, 1);
    const result = finishExecutionRecord(record, "success", undefined, Date.parse(record.startedAt) + 15);
    expect(result.status).toBe("success");
    expect(result.durationMs).toBe(15);
    expect(result.endedAt).toBeTruthy();
  });
});
