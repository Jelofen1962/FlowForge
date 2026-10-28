import { describe, expect, it } from 'vitest';
import { executeWorkflow, createDefaultRegistry, ActionRegistry } from '../src/workflow/engine';
import { validateWorkflow, type Workflow } from '../src/workflow/schema';
import { resolveExpression } from '../src/workflow/expression';
import { detectJsonFields, parseJson } from '../src/data/jsonFields';
import { runBatch } from '../src/data/batch';
import { parseCsv, parseTextLines, stringifyCsv } from '../src/data/formats';

const workflow: Workflow = {
  schemaVersion: 1, id: 'test', name: 'Test flow',
  nodes: [
    { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
    { id: 'set', type: 'setVariable', label: 'Set value', position: { x: 0, y: 100 }, config: { name: 'answer', value: 42 }, disabled: false },
    { id: 'log', type: 'log', label: 'Log', position: { x: 0, y: 200 }, config: { message: 'done' }, disabled: false },
  ],
  edges: [{ id: 'e1', source: 'start', target: 'set' }, { id: 'e2', source: 'set', target: 'log' }],
  variables: [{ name: 'greeting', type: 'string', value: 'hello', scope: 'workflow' }],
};

describe('workflow validation and execution', () => {
  it('accepts a valid workflow and rejects missing edge endpoints', () => {
    expect(validateWorkflow(workflow).errors).toEqual([]);
    const invalid = { ...workflow, edges: [...workflow.edges, { id: 'bad', source: 'missing', target: 'log' }] };
    expect(validateWorkflow(invalid).errors.join(' ')).toContain('missing source');
  });
  it('rejects graph cycles before execution', () => {
    const cyclic = { ...workflow, edges: [...workflow.edges, { id: 'e3', source: 'log', target: 'set' }] };
    expect(validateWorkflow(cyclic).errors.join(' ')).toContain('cycle');
  });
  it('executes registered actions in connected order', async () => {
    const result = await executeWorkflow(workflow, createDefaultRegistry());
    expect(result.status).toBe('succeeded');
    expect(result.steps.map((step) => step.nodeId)).toEqual(['start', 'set', 'log']);
    expect(result.variables.answer).toBe(42);
    expect(result.logs).toEqual(['done']);
  });
  it('executes merged paths only after all predecessors', async () => {
    const dag: Workflow = {
      schemaVersion: 1, id: 'dag', name: 'Merged path', variables: [],
      nodes: [
        { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        ...['a', 'b', 'c', 'd'].map((id) => ({ id, type: 'log' as const, label: id, position: { x: 0, y: 0 }, config: { message: id }, disabled: false })),
      ],
      edges: [
        { id: 's-a', source: 'start', target: 'a' }, { id: 's-b', source: 'start', target: 'b' },
        { id: 'a-c', source: 'a', target: 'c' }, { id: 'b-d', source: 'b', target: 'd' }, { id: 'd-c', source: 'd', target: 'c' },
      ],
    };
    const result = await executeWorkflow(dag);
    const positions = Object.fromEntries(result.steps.map((step, index) => [step.nodeId, index]));
    expect(positions.a).toBeLessThan(positions.c);
    expect(positions.d).toBeLessThan(positions.c);
  });
  it('reports cancellation requested during the final action', async () => {
    const controller = new AbortController();
    const registry = new ActionRegistry();
    registry.register('start', async () => undefined);
    registry.register('log', async (_config, context) => { controller.abort(); context.log('stopped'); return 'stopped'; });
    const result = await executeWorkflow({ ...workflow, nodes: [workflow.nodes[0], workflow.nodes[2]], edges: [{ id: 'e1', source: 'start', target: 'log' }] }, registry, { signal: controller.signal });
    expect(result.status).toBe('cancelled');
  });
  it('rejects reserved variable names', async () => {
    const changed = { ...workflow, nodes: workflow.nodes.map((node) => node.id === 'set' ? { ...node, config: { name: '__proto__', value: 'unsafe' } } : node) };
    const result = await executeWorkflow(changed, createDefaultRegistry());
    expect(result.status).toBe('failed');
    expect(result.error).toContain('reserved');
  });
  it('fails visibly for an unregistered action', async () => {
    const changed = { ...workflow, nodes: workflow.nodes.map((node) => node.id === 'log' ? { ...node, type: 'openUrl' as const } : node) };
    const result = await executeWorkflow(changed, createDefaultRegistry());
    expect(result.status).toBe('failed');
    expect(result.error).toContain('No handler registered');
  });
});

describe('expressions and JSON fields', () => {
  it('resolves nested variables without evaluating JavaScript', () => {
    expect(resolveExpression('{{variables.product.url}}', { variables: { product: { url: 'https://example.com' } } })).toBe('https://example.com');
    expect(() => resolveExpression('{{variables.missing}}', { variables: {} })).toThrow('Unresolved expression');
  });
  it('detects nested paths and arrays', () => {
    const fields = detectJsonFields(parseJson('[{"id":1,"item":{"name":"A"},"tags":["x"]},{"id":2,"item":{"name":"B"}}]'));
    expect(fields.map((field) => field.path)).toContain('item.name');
    expect(fields.find((field) => field.path === 'tags')?.isArray).toBe(true);
  });
  it('reports malformed JSON', () => expect(() => parseJson('{broken')).toThrow('Invalid JSON'));
});

describe('batch processing', () => {
  it('continues after row errors and reports each result', async () => {
    const results = await runBatch([1, 2, 3], async (value) => { if (value === 2) throw new Error('bad row'); return value * 2; });
    expect(results.map((item) => item.status)).toEqual(['succeeded', 'failed', 'succeeded']);
    expect(results[1].error).toBe('bad row');
  });
  it('retries a failed row within the configured limit', async () => {
    let attempts = 0;
    const results = await runBatch([4], async () => { attempts++; if (attempts < 2) throw new Error('temporary'); return 'ok'; }, { retries: 1 });
    expect(results[0].status).toBe('succeeded');
    expect(results[0].attempts).toBe(2);
  });
});


describe('text and CSV formats', () => {
  it('parses quoted CSV cells and escapes output', () => {
    const rows = parseCsv('name,notes\r\nAda,\"hello, world\"\r\nLin,\"said \"\"hi\"\"\"');
    expect(rows[0].notes).toBe('hello, world');
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
  it('preserves original line numbers for text input', () => {
    expect(parseTextLines('first\n\nthird')).toEqual([{ lineNumber: 1, text: 'first' }, { lineNumber: 3, text: 'third' }]);
  });
});
