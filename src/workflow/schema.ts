import { z } from 'zod';

export const NodeKind = z.enum([
  'start', 'openUrl', 'click', 'typeText', 'selectOption', 'waitForElement', 'readAttribute', 'extractText', 'extractLinks', 'extractItems', 'extractImages', 'setVariable', 'forEach', 'if', 'writeFile', 'exportCsv', 'log', 'subworkflow',
]);
export type NodeKind = z.infer<typeof NodeKind>;

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: NodeKind,
  label: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.unknown()).default({}),
  disabled: z.boolean().default(false),
  group: z.string().min(1).optional(),
});
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1), source: z.string().min(1), target: z.string().min(1),
  sourceHandle: z.string().optional(), targetHandle: z.string().optional(),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export const VariableSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).refine((name) => !['__proto__', 'prototype', 'constructor'].includes(name), 'Reserved variable name'),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'secret']),
  value: z.unknown().optional(), description: z.string().optional(),
  scope: z.enum(['workflow', 'run', 'item', 'environment']).default('workflow'),
});

export const WorkflowSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1), name: z.string().min(1),
  nodes: z.array(WorkflowNodeSchema).max(10000), edges: z.array(WorkflowEdgeSchema).max(20000),
  variables: z.array(VariableSchema).default([]),
  updatedAt: z.string().optional(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

export function validateWorkflow(input: unknown): { workflow?: Workflow; errors: string[] } {
  const parsed = WorkflowSchema.safeParse(input);
  if (!parsed.success) return { errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  const workflow = parsed.data;
  const errors: string[] = [];
  const configString = (node: WorkflowNode, key: string, required = false) => {
    const value = node.config[key];
    if (required && (typeof value !== 'string' || !value.trim())) errors.push(`Node ${node.id}: ${key} must be a non-empty string`);
    else if (value !== undefined && typeof value !== 'string') errors.push(`Node ${node.id}: ${key} must be a string`);
    if (typeof value === 'string' && value.length > 100_000) errors.push(`Node ${node.id}: ${key} exceeds the 100,000 character limit`);
  };
  for (const node of workflow.nodes) {
    if (['click', 'typeText', 'selectOption', 'waitForElement', 'readAttribute'].includes(node.type)) configString(node, 'selector', true);
    if (node.type === 'openUrl') configString(node, 'url', true);
    if (node.type === 'typeText') configString(node, 'text');
    if (node.type === 'selectOption' && typeof node.config.value !== 'string') errors.push(`Node ${node.id}: value must be a string`);
    if (['click', 'typeText', 'selectOption', 'waitForElement', 'readAttribute'].includes(node.type) && node.config.strategy !== undefined && !['css', 'xpath', 'id'].includes(String(node.config.strategy))) errors.push(`Node ${node.id}: strategy must be css, xpath, or id`);
    if (['click', 'typeText', 'selectOption', 'waitForElement', 'readAttribute'].includes(node.type)) configString(node, 'frameSelector');
    if (typeof node.config.frameSelector === 'string' && node.config.frameSelector.length > 2048) errors.push(`Node ${node.id}: frameSelector exceeds the 2048 character limit`);
    if (['extractText', 'extractLinks'].includes(node.type)) configString(node, 'selector');
    if (node.type === 'extractItems') {
      configString(node, 'itemSelector', true);
      const fields = node.config.fields;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !Object.keys(fields).length || Object.entries(fields as Record<string, unknown>).some(([name, selector]) => !name.trim() || typeof selector !== 'string' || !selector.trim())) errors.push(`Node ${node.id}: fields must map non-empty names to CSS selectors`);
      const maxPages = node.config.maxPages;
      if (Object.values(fields as Record<string, unknown>).some((selector) => typeof selector === 'string' && selector.length > 2048)) errors.push(`Node ${node.id}: field selectors must be 2048 characters or fewer`);
      if (maxPages !== undefined && (!Number.isInteger(maxPages) || Number(maxPages) < 1 || Number(maxPages) > 100)) errors.push(`Node ${node.id}: maxPages must be an integer from 1 to 100`);
      configString(node, 'nextSelector');
    }
    if (node.type === 'extractImages') configString(node, 'selector');
    if (['readAttribute', 'extractText', 'extractLinks', 'extractItems', 'extractImages'].includes(node.type) && node.config.outputVariable !== undefined && (typeof node.config.outputVariable !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(node.config.outputVariable) || ['__proto__', 'prototype', 'constructor'].includes(node.config.outputVariable))) errors.push(`Node ${node.id}: outputVariable must be a valid variable name`);
    if (node.type === 'forEach' && node.config.maxItems !== undefined && (!Number.isInteger(node.config.maxItems) || Number(node.config.maxItems) < 0 || Number(node.config.maxItems) > 10000)) errors.push(`Node ${node.id}: maxItems must be an integer from 0 to 10000`);
    if (node.type === 'subworkflow') {
      if (!node.config.workflow || typeof node.config.workflow !== 'object' || Array.isArray(node.config.workflow)) {
        errors.push(`Node ${node.id}: workflow must be a configured workflow object`);
      } else {
        const child = validateWorkflow(node.config.workflow);
        if (child.errors.length) errors.push(...child.errors.map((error) => `Node ${node.id} subworkflow: ${error}`));
      }
      if (node.config.inputs !== undefined && (!node.config.inputs || typeof node.config.inputs !== 'object' || Array.isArray(node.config.inputs))) errors.push(`Node ${node.id}: inputs must be an object`);
      if (node.config.outputs !== undefined && (!node.config.outputs || typeof node.config.outputs !== 'object' || Array.isArray(node.config.outputs))) errors.push(`Node ${node.id}: outputs must map parent variable names to child variable names`);
      if (node.config.outputs && typeof node.config.outputs === 'object' && !Array.isArray(node.config.outputs)) {
        for (const [parentName, childName] of Object.entries(node.config.outputs as Record<string, unknown>)) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parentName) || ['__proto__', 'prototype', 'constructor'].includes(parentName)) errors.push(`Node ${node.id}: invalid or reserved parent output name: ${parentName}`);
          if (typeof childName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(childName) || ['__proto__', 'prototype', 'constructor'].includes(childName)) errors.push(`Node ${node.id}: output mapping for ${parentName} must name a valid child variable`);
        }
      }
      if (node.config.outputVariable !== undefined && (typeof node.config.outputVariable !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(node.config.outputVariable) || ['__proto__', 'prototype', 'constructor'].includes(node.config.outputVariable))) errors.push(`Node ${node.id}: outputVariable must be a valid variable name`);
    }
  }
  const ids = new Set<string>();
  for (const node of workflow.nodes) {
    if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    ids.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of workflow.edges) {
    if (edgeIds.has(edge.id)) errors.push(`Duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!ids.has(edge.source)) errors.push(`Edge ${edge.id} has missing source: ${edge.source}`);
    if (!ids.has(edge.target)) errors.push(`Edge ${edge.id} has missing target: ${edge.target}`);
    if (edge.source === edge.target) errors.push(`Self-loop is not allowed: ${edge.id}`);
    const sourceNode = workflow.nodes.find((node) => node.id === edge.source);
    if (sourceNode?.type === 'if' && edge.sourceHandle && !['true', 'false'].includes(edge.sourceHandle)) {
      errors.push(`Conditional edge ${edge.id} must use the true or false output handle`);
    }
    if (sourceNode?.type === 'forEach' && edge.sourceHandle && !['item', 'done'].includes(edge.sourceHandle)) {
      errors.push(`Loop edge ${edge.id} must use the item or done output handle`);
    }
  }
  if (workflow.nodes.some((node) => node.type === 'if' && workflow.edges.filter((edge) => edge.source === node.id).some((edge) => !edge.sourceHandle))) {
    errors.push('Conditional connections must use true or false output handles');
  }
  const variableNames = new Set<string>();
  for (const variable of workflow.variables) {
    if (variableNames.has(variable.name)) errors.push(`Duplicate variable: ${variable.name}`);
    variableNames.add(variable.name);
  }
  const starts = workflow.nodes.filter((node) => node.type === 'start');
  if (starts.length !== 1) errors.push(`Workflow must contain exactly one start node (found ${starts.length})`);
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const id of ids) { adjacency.set(id, []); indegree.set(id, 0); }
  for (const edge of workflow.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  if (starts[0] && (indegree.get(starts[0].id) ?? 0) > 0) errors.push('Start node cannot have incoming connections');
  const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visitedCount = 0;
  while (ready.length) {
    const id = ready.pop()!;
    visitedCount++;
    for (const target of adjacency.get(id) ?? []) {
      const degree = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, degree);
      if (degree === 0) ready.push(target);
    }
  }
  if (visitedCount !== ids.size) errors.push('Workflow graph contains a cycle');
  return errors.length ? { errors } : { workflow, errors };
}

export function serializeWorkflow(workflow: Workflow): string {
  return `${JSON.stringify(workflow, null, 2)}\n`;
}
