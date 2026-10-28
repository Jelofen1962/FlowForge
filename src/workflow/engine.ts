import type { WorkflowNode } from './schema';
import { validateWorkflow } from './schema';
import { resolveExpression } from './expression';

export type RunStatus = 'succeeded' | 'failed' | 'cancelled';
export interface StepResult { nodeId: string; status: RunStatus; startedAt: string; durationMs: number; output?: unknown; error?: string }
export interface RunResult { status: RunStatus; steps: StepResult[]; variables: Record<string, unknown>; logs: string[]; error?: string }
interface LoopState { iterations: number }
export interface RunOptions { signal?: AbortSignal; onStep?: (result: StepResult) => void; maxSteps?: number; initialVariables?: Record<string, unknown>; depth?: number; loopState?: LoopState }
export type ActionHandler = (config: Record<string, unknown>, context: ActionContext) => Promise<unknown>;
export interface ActionContext { variables: Record<string, unknown>; item?: unknown; index?: number; signal?: AbortSignal; depth?: number; loopState?: LoopState; log: (message: string) => void }

export class ActionRegistry {
  private handlers = new Map<string, ActionHandler>();
  register(type: string, handler: ActionHandler): void {
    if (this.handlers.has(type)) throw new Error(`Action already registered: ${type}`);
    this.handlers.set(type, handler);
  }
  get(type: string): ActionHandler | undefined { return this.handlers.get(type); }
}

function evaluateCondition(config: Record<string, unknown>): boolean {
  const left = config.left;
  const right = config.right;
  switch (config.operator ?? 'equals') {
    case 'equals': return Object.is(left, right);
    case 'notEquals': return !Object.is(left, right);
    case 'contains':
      if (typeof left === 'string' && typeof right === 'string') return left.includes(right);
      if (Array.isArray(left)) return left.some((value) => Object.is(value, right));
      throw new Error('Condition "contains" requires a string or array on the left');
    case 'greaterThan':
    case 'lessThan': {
      const a = Number(left); const b = Number(right);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('Numeric conditions require two finite numbers');
      return config.operator === 'greaterThan' ? a > b : a < b;
    }
    case 'isTruthy': return Boolean(left);
    default: throw new Error(`Unsupported condition operator: ${String(config.operator)}`);
  }
}

export function createDefaultRegistry(): ActionRegistry {
  const registry = new ActionRegistry();
  registry.register('start', async () => undefined);
  registry.register('if', async (config) => evaluateCondition(config));
  registry.register('subworkflow', async (config, context) => {
    if ((context.depth ?? 0) >= 10) throw new Error('Subworkflow nesting exceeds the 10-level limit');
    if (config.inputs !== undefined && (!config.inputs || typeof config.inputs !== 'object' || Array.isArray(config.inputs))) throw new Error('Subworkflow inputs must be an object');
    const inputs = (config.inputs ?? {}) as Record<string, unknown>;
    const outputVariable = config.outputVariable;
    if (outputVariable !== undefined && (typeof outputVariable !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(outputVariable) || ['__proto__', 'prototype', 'constructor'].includes(outputVariable))) throw new Error('Subworkflow output variable name is invalid or reserved');
    const result = await executeWorkflow(config.workflow, registry, { signal: context.signal, depth: (context.depth ?? 0) + 1, initialVariables: inputs, maxSteps: 1000, loopState: context.loopState });
    if (result.status !== 'succeeded') throw new Error(result.error ?? `Subworkflow ${result.status}`);
    if (typeof outputVariable === 'string' && outputVariable) context.variables[outputVariable] = result.variables;
    return result.variables;
  });
  registry.register('setVariable', async (config, context) => {
    const name = String(config.name ?? '');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Variable name is invalid or reserved');
    context.variables[name] = resolveExpression(config.value, { variables: context.variables, item: context.item, index: context.index });
    return context.variables[name];
  });
  registry.register('log', async (config, context) => {
    const message = String(resolveExpression(config.message ?? '', { variables: context.variables, item: context.item, index: context.index }));
    context.log(message);
    return message;
  });
  registry.register('forEach', async (config, context) => {
    if (!Array.isArray(config.items)) throw new Error('For each requires an array in "items"');
    if (!Array.isArray(config.actions)) throw new Error('For each requires an "actions" array');
    const maxItems = Math.max(0, Math.min(Number(config.maxItems ?? 1000), 10000));
    if (!Number.isFinite(maxItems)) throw new Error('For each maxItems must be a finite number');
    const items = config.items.slice(0, Math.floor(maxItems));
    const results: unknown[] = [];
    for (let index = 0; index < items.length; index++) {
      if (context.signal?.aborted) throw new Error('Loop cancelled');
      const loopState = context.loopState ?? { iterations: 0 };
      if (++loopState.iterations > 10000) throw new Error('Workflow exceeded 10,000 total loop iterations');
      const itemResults: unknown[] = [];
      for (const action of config.actions as { type?: unknown; config?: unknown }[]) {
        if (!action || typeof action.type !== 'string' || !action.config || typeof action.config !== 'object' || Array.isArray(action.config)) {
          throw new Error('Each loop action needs a type and config object');
        }
        const handler = registry.get(action.type);
        if (!handler) throw new Error(`No handler registered for loop action: ${action.type}`);
        const actionContext = { variables: context.variables, item: items[index], index, signal: context.signal, log: context.log };
        const rawConfig = action.config as Record<string, unknown>;
        const resolved = action.type === 'forEach'
          ? { ...rawConfig, items: resolveExpression(rawConfig.items, actionContext), maxItems: resolveExpression(rawConfig.maxItems ?? 1000, actionContext) }
          : resolveExpression(rawConfig, actionContext) as Record<string, unknown>;
        itemResults.push(await handler(resolved, { ...context, item: items[index], index }));
      }
      results.push(itemResults);
    }
    return results;
  });
  return registry;
}

export async function executeWorkflow(input: unknown, registry = createDefaultRegistry(), options: RunOptions = {}): Promise<RunResult> {
  const validation = validateWorkflow(input);
  if (!validation.workflow) return { status: 'failed', steps: [], variables: {}, logs: [], error: validation.errors.join('; ') };
  const workflow = validation.workflow;
  const byId = new Map<string, WorkflowNode>(workflow.nodes.map((node) => [node.id, node] as const));
  const outgoing = new Map<string, typeof workflow.edges>();
  for (const edge of workflow.edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  const start = workflow.nodes.find((node) => node.type === 'start');
  if (!start) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Workflow requires a start node' };

  const reachable = new Set<string>();
  const pending = [start.id];
  while (pending.length) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    pending.push(...(outgoing.get(id) ?? []).map((edge) => edge.target));
  }
  const indegree = new Map<string, number>();
  for (const id of reachable) indegree.set(id, 0);
  for (const edge of workflow.edges) {
    if (reachable.has(edge.source) && reachable.has(edge.target)) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const ready = workflow.nodes.filter((node) => reachable.has(node.id) && indegree.get(node.id) === 0).map((node) => node.id);
  const executionOrder: string[] = [];
  while (ready.length) {
    const id = ready.pop()!;
    executionOrder.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      if (!reachable.has(edge.target)) continue;
      const degree = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, degree);
      if (degree === 0) ready.push(edge.target);
    }
  }
  if (executionOrder.length !== reachable.size) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Workflow graph contains a cycle' };
  if ((options.depth ?? 0) > 10) return { status: 'failed', steps: [], variables: {}, logs: [], error: 'Subworkflow nesting exceeds the 10-level limit' };
  const variables = { ...Object.fromEntries(workflow.variables.filter((v) => v.scope === 'workflow').map((v) => [v.name, v.value])), ...(options.initialVariables ?? {}) };
  const loopState = options.loopState ?? { iterations: 0 };
  const steps: StepResult[] = [];
  const logs: string[] = [];
  const outputs: Record<string, unknown> = {};
  const activeNodes = new Set<string>([start.id]);
  const maxSteps = Math.max(1, Math.min(options.maxSteps ?? 1000, 10000));
  const log = (message: string) => { logs.push(message); };

  for (const id of executionOrder) {
    if (options.signal?.aborted) return { status: 'cancelled', steps, variables, logs };
    const node = byId.get(id)!;
    if (!activeNodes.has(id)) continue;
    if (steps.length >= maxSteps) return { status: 'failed', steps, variables, logs, error: `Execution exceeded ${maxSteps} steps` };
    if (node.disabled) {
      for (const edge of outgoing.get(id) ?? []) activeNodes.add(edge.target);
      continue;
    }
    const started = Date.now();
    let result: StepResult;
    try {
      const handler = registry.get(node.type);
      if (!handler) throw new Error(`No handler registered for action: ${node.type}`);
      const expressionContext = { variables, steps: outputs };
      const config = node.type === 'forEach'
        ? { ...node.config, items: resolveExpression(node.config.items, expressionContext), maxItems: resolveExpression(node.config.maxItems ?? 1000, expressionContext) }
        : node.type === 'subworkflow'
          ? { ...node.config, inputs: resolveExpression(node.config.inputs ?? {}, expressionContext) }
          : resolveExpression(node.config, expressionContext);
      const output = await handler(config as Record<string, unknown>, { variables, signal: options.signal, depth: options.depth ?? 0, loopState, log });
      outputs[node.id] = { output };
      result = { nodeId: id, status: 'succeeded', startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, output };
    } catch (error) {
      const cancelled = options.signal?.aborted ?? false;
      result = { nodeId: id, status: cancelled ? 'cancelled' : 'failed', startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
      steps.push(result); options.onStep?.(result);
      return { status: cancelled ? 'cancelled' : 'failed', steps, variables, logs, ...(cancelled ? {} : { error: result.error }) };
    }
    steps.push(result); options.onStep?.(result);
    if (node.type === 'if') {
      const branch = result.output === true ? 'true' : 'false';
      for (const edge of outgoing.get(id) ?? []) {
        if (edge.sourceHandle === branch || (!edge.sourceHandle && branch === 'true')) activeNodes.add(edge.target);
      }
    } else if (node.type === 'forEach') {
      const branch = Array.isArray(result.output) && result.output.length ? 'item' : 'done';
      for (const edge of outgoing.get(id) ?? []) if (edge.sourceHandle === branch) activeNodes.add(edge.target);
    } else {
      for (const edge of outgoing.get(id) ?? []) activeNodes.add(edge.target);
    }
    if (options.signal?.aborted) return { status: 'cancelled', steps, variables, logs };
  }
  return { status: 'succeeded', steps, variables, logs };
}
