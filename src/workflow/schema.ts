import { z } from 'zod';

export const NodeKind = z.enum([
  'start', 'openUrl', 'click', 'typeText', 'waitForElement', 'readAttribute', 'extractText', 'extractLinks', 'extractItems', 'setVariable', 'forEach', 'if', 'writeFile', 'log', 'subworkflow',
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
