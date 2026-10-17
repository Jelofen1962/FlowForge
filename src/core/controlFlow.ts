import type { WorkflowStep } from "./workflow";

export type ConditionOperator =
  | "equals" | "notEquals" | "contains" | "notContains"
  | "matches" | "greaterThan" | "lessThan" | "truthy" | "falsy";

export interface StepCondition {
  source: "variable" | "lastText" | "url" | "urlChanged" | "stepStatus";
  key?: string;
  operator: ConditionOperator;
  expected?: string;
}

export interface ControlFlowConfig {
  condition?: StepCondition;
  loop?: {
    mode: "count" | "while";
    count?: number;
    condition?: StepCondition;
    maxIterations?: number;
  };
  retry?: {
    attempts: number;
    delayMs: number;
  };
}

export interface RuntimeContext {
  variables: Record<string, string>;
  lastText: string;
  url: string;
  urlChanged?: boolean;
  stepStatus: Record<string, "success" | "error" | "skipped">;
}

export interface StepExecutionRecord {
  stepId: string;
  index: number;
  attempt: number;
  status: "running" | "success" | "error" | "skipped";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  message?: string;
}

export function evaluateCondition(condition: StepCondition, context: RuntimeContext): boolean {
  let actual: string;
  switch (condition.source) {
    case "variable":
      if (!condition.key || !Object.prototype.hasOwnProperty.call(context.variables, condition.key)) {
        throw new Error(`Condition refers to unknown variable "${condition.key ?? ""}".`);
      }
      actual = context.variables[condition.key];
      break;
    case "lastText": actual = context.lastText; break;
    case "url": actual = context.url; break;
    case "urlChanged": actual = String(context.urlChanged === true); break;
    case "stepStatus":
      if (!condition.key || !Object.prototype.hasOwnProperty.call(context.stepStatus, condition.key)) {
        throw new Error(`Condition refers to unknown step id "${condition.key ?? ""}".`);
      }
      actual = context.stepStatus[condition.key];
      break;
    default: throw new Error("Unsupported condition source.");
  }
  const expected = condition.expected ?? "";
  switch (condition.operator) {
    case "equals": return actual === expected;
    case "notEquals": return actual !== expected;
    case "contains": return actual.includes(expected);
    case "notContains": return !actual.includes(expected);
    case "matches": {
      if (expected.length > 500) throw new Error("Regular expression is too long (maximum 500 characters).");
      try { return new RegExp(expected).test(actual); }
      catch { throw new Error("Condition contains an invalid regular expression."); }
    }
    case "greaterThan": {
      const a = Number(actual), b = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Numeric condition requires numeric actual and expected values.");
      return a > b;
    }
    case "lessThan": {
      const a = Number(actual), b = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Numeric condition requires numeric actual and expected values.");
      return a < b;
    }
    case "truthy": return actual.length > 0 && actual !== "false" && actual !== "0";
    case "falsy": return actual.length === 0 || actual === "false" || actual === "0";
    default: throw new Error("Unsupported condition operator.");
  }
}

export function validateControlFlow(config: ControlFlowConfig): string[] {
  const errors: string[] = [];
  if (config.condition) {
    if (!["variable", "lastText", "url", "urlChanged", "stepStatus"].includes(config.condition.source)) errors.push("Unsupported condition source.");
    if (!["equals", "notEquals", "contains", "notContains", "matches", "greaterThan", "lessThan", "truthy", "falsy"].includes(config.condition.operator)) errors.push("Unsupported condition operator.");
    if (config.condition.source === "variable" && !config.condition.key?.trim()) errors.push("Variable conditions need a variable name.");
    if (config.condition.source === "stepStatus" && !config.condition.key?.trim()) errors.push("Step-status conditions need a step id.");
  }
  if (config.loop) {
    if (config.loop.mode === "count") {
      if (!Number.isInteger(config.loop.count) || (config.loop.count ?? -1) < 0 || (config.loop.count ?? 0) > 10_000) {
        errors.push("Loop count must be an integer between 0 and 10,000.");
      }
    } else if (config.loop.mode === "while") {
      if (!config.loop.condition) errors.push("While loops need a condition.");
      if (!Number.isInteger(config.loop.maxIterations) || (config.loop.maxIterations ?? 0) < 1 || (config.loop.maxIterations ?? 0) > 10_000) {
        errors.push("While loops require maxIterations between 1 and 10,000.");
      }
    } else errors.push("Unsupported loop mode.");
  }
  if (config.retry) {
    if (!Number.isInteger(config.retry.attempts) || config.retry.attempts < 1 || config.retry.attempts > 10) {
      errors.push("Retry attempts must be an integer between 1 and 10.");
    }
    if (!Number.isInteger(config.retry.delayMs) || config.retry.delayMs < 0 || config.retry.delayMs > 60_000) {
      errors.push("Retry delay must be an integer between 0 and 60,000 ms.");
    }
  }
  return errors;
}

/** Executes a bounded operation with explicit retries; caller owns the operation's side-effect safety. */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  config: { attempts: number; delayMs: number },
  onAttempt?: (attempt: number, error?: unknown) => void
): Promise<T> {
  const errors = validateControlFlow({ retry: config });
  if (errors.length) throw new Error(errors.join(" "));
  let lastError: unknown;
  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    onAttempt?.(attempt);
    try { return await operation(attempt); }
    catch (error) {
      lastError = error;
      onAttempt?.(attempt, error);
      if (attempt < config.attempts && config.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function runCountedLoop<T>(
  count: number,
  maxIterations: number,
  body: (iteration: number) => Promise<T>
): Promise<T[]> {
  if (!Number.isInteger(count) || count < 0 || count > 10_000) throw new Error("Loop count must be an integer between 0 and 10,000.");
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 10_000) throw new Error("maxIterations must be between 1 and 10,000.");
  if (count > maxIterations) throw new Error(`Loop count ${count} exceeds maxIterations ${maxIterations}.`);
  const results: T[] = [];
  for (let i = 0; i < count; i++) results.push(await body(i + 1));
  return results;
}

export function createExecutionRecord(stepId: string, index: number, attempt: number): StepExecutionRecord {
  return { stepId, index, attempt, status: "running", startedAt: new Date().toISOString() };
}

export function finishExecutionRecord(
  record: StepExecutionRecord,
  status: StepExecutionRecord["status"],
  message?: string,
  endedAt = Date.now()
): StepExecutionRecord {
  const started = Date.parse(record.startedAt);
  return {
    ...record, status, message,
    endedAt: new Date(endedAt).toISOString(),
    durationMs: Number.isFinite(started) ? Math.max(0, endedAt - started) : undefined
  };
}
