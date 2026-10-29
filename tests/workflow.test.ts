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
  it('resets item-scoped variables for each loop iteration', async () => {
    const scoped: Workflow = {
      schemaVersion: 1, id: 'item-scope', name: 'Item scope',
      variables: [{ name: 'current', type: 'string', value: 'default', scope: 'item' }],
      nodes: [
        { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'loop', type: 'forEach', label: 'Loop', position: { x: 0, y: 1 }, config: { items: ['first', 'second'], actions: [{ type: 'setVariable', config: { name: 'current', value: '{{item}}' } }, { type: 'log', config: { message: '{{variables.current}}' } }] }, disabled: false },
      ],
      edges: [{ id: 'start-loop', source: 'start', target: 'loop' }],
    };
    const result = await executeWorkflow(scoped, createDefaultRegistry());
    expect(result.status).toBe('succeeded');
    expect(result.logs).toEqual(['first', 'second']);
    expect(result.variables.current).toBeUndefined();
  });
  it('executes registered actions in connected order', async () => {
    const result = await executeWorkflow(workflow, createDefaultRegistry());
    expect(result.status).toBe('succeeded');
    expect(result.steps.map((step) => step.nodeId)).toEqual(['start', 'set', 'log']);
    expect(result.variables.answer).toBe(42);
    expect(result.logs).toEqual(['done']);
  });
  it('routes only the selected conditional branch', async () => {
    const conditional: Workflow = {
      schemaVersion: 1, id: 'branch', name: 'Conditional', variables: [{ name: 'allowed', type: 'boolean', value: true, scope: 'workflow' }],
      nodes: [
        { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'if', type: 'if', label: 'Condition', position: { x: 0, y: 1 }, config: { left: '{{variables.allowed}}', operator: 'equals', right: true }, disabled: false },
        { id: 'yes', type: 'log', label: 'Yes', position: { x: 0, y: 2 }, config: { message: 'yes' }, disabled: false },
        { id: 'no', type: 'log', label: 'No', position: { x: 1, y: 2 }, config: { message: 'no' }, disabled: false },
        { id: 'done', type: 'log', label: 'Done', position: { x: 0, y: 3 }, config: { message: 'done' }, disabled: false },
      ],
      edges: [
        { id: 'start-if', source: 'start', target: 'if' },
        { id: 'if-yes', source: 'if', sourceHandle: 'true', target: 'yes' },
        { id: 'if-no', source: 'if', sourceHandle: 'false', target: 'no' },
        { id: 'yes-done', source: 'yes', target: 'done' },
        { id: 'no-done', source: 'no', target: 'done' },
      ],
    };
    const result = await executeWorkflow(conditional);
    expect(result.status).toBe('succeeded');
    expect(result.steps.map((step) => step.nodeId)).toEqual(['start', 'if', 'yes', 'done']);
    expect(result.logs).toEqual(['yes', 'done']);
  });
  it('runs bounded nested loops and exposes item/index expressions', async () => {
    const loop: Workflow = {
      schemaVersion: 1, id: 'loops', name: 'Nested loops', variables: [{ name: 'rows', type: 'array', value: [1, 2], scope: 'workflow' }],
      nodes: [
        { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'loop', type: 'forEach', label: 'Loop', position: { x: 0, y: 1 }, config: { items: '{{variables.rows}}', maxItems: 10, actions: [
          { type: 'log', config: { message: '{{item}}' } },
          { type: 'forEach', config: { items: [1, 2], maxItems: 2, actions: [{ type: 'log', config: { message: '{{index}}' } }] } },
        ] }, disabled: false },
      ], edges: [{ id: 'start-loop', source: 'start', target: 'loop' }],
    };
    const result = await executeWorkflow(loop);
    expect(result.status).toBe('succeeded');
    expect(result.logs).toEqual(['1', '0', '1', '2', '0', '1']);
  });
  it('caps total iterations across nested loops', async () => {
    const nested: Workflow = {
      schemaVersion: 1, id: 'loop-cap', name: 'Loop cap', variables: [],
      nodes: [
        { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'loop', type: 'forEach', label: 'Loop', position: { x: 0, y: 1 }, config: { items: Array.from({ length: 101 }, (_, i) => i), maxItems: 101, actions: [{ type: 'forEach', config: { items: Array.from({ length: 101 }, (_, i) => i), maxItems: 101, actions: [{ type: 'log', config: { message: 'x' } }] } }] }, disabled: false },
      ], edges: [{ id: 'start-loop', source: 'start', target: 'loop' }],
    };
    const result = await executeWorkflow(nested);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('10,000 total loop iterations');
  });
  it('stops remaining inline loop actions immediately after cancellation', async () => {
    const controller = new AbortController();
    let laterActionRan = false;
    const registry = createDefaultRegistry();
    registry.register('cancelNow', async () => { controller.abort(); });
    registry.register('shouldNotRun', async () => { laterActionRan = true; });
    const loop: Workflow = {
      schemaVersion: 1, id: 'cancel-loop', name: 'Cancel loop', variables: [],
      nodes: [
        { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'loop', type: 'forEach', label: 'Loop', position: { x: 0, y: 1 }, config: { items: [1, 2], actions: [
          { type: 'cancelNow', config: {} },
          { type: 'shouldNotRun', config: {} },
        ] }, disabled: false },
      ],
      edges: [{ id: 'start-loop', source: 'start', target: 'loop' }],
    };
    const result = await executeWorkflow(loop, registry, { signal: controller.signal });
    expect(result.status).toBe('cancelled');
    expect(laterActionRan).toBe(false);
  });
  it('resets the total loop budget for each run when reusing a registry', async () => {
    const repeated: Workflow = {
      schemaVersion: 1, id: 'repeat-loop', name: 'Repeat loop', variables: [],
      nodes: [
        { id: 'start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'loop', type: 'forEach', label: 'Loop', position: { x: 0, y: 1 }, config: { items: Array.from({ length: 10000 }, (_, index) => index), maxItems: 10000, actions: [] }, disabled: false },
      ],
      edges: [{ id: 'start-loop', source: 'start', target: 'loop' }],
    };
    const registry = createDefaultRegistry();
    expect((await executeWorkflow(repeated, registry)).status).toBe('succeeded');
    expect((await executeWorkflow(repeated, registry)).status).toBe('succeeded');
  });
  it('invokes a saved subworkflow with inputs and returns its variables', async () => {
    const child: Workflow = {
      schemaVersion: 1, id: 'child', name: 'Child',
      nodes: [
        { id: 'child-start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'child-set', type: 'setVariable', label: 'Set result', position: { x: 0, y: 1 }, config: { name: 'result', value: '{{variables.inputValue}}' }, disabled: false },
      ], edges: [{ id: 'child-edge', source: 'child-start', target: 'child-set' }], variables: [],
    };
    const parent: Workflow = {
      schemaVersion: 1, id: 'parent', name: 'Parent',
      nodes: [
        { id: 'parent-start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'call', type: 'subworkflow', label: 'Call child', position: { x: 0, y: 1 }, config: { workflow: child, inputs: { inputValue: 'hello' }, outputVariable: 'childResult' }, disabled: false },
      ], edges: [{ id: 'parent-edge', source: 'parent-start', target: 'call' }], variables: [],
    };
    const result = await executeWorkflow(parent);
    expect(result.status).toBe('succeeded');
    expect(result.variables.childResult).toMatchObject({ result: 'hello' });
  });
  it('maps selected subworkflow outputs into parent variables', async () => {
    const child: Workflow = {
      schemaVersion: 1, id: 'mapped-child', name: 'Mapped child', variables: [],
      nodes: [
        { id: 'child-start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'child-set', type: 'setVariable', label: 'Set result', position: { x: 0, y: 1 }, config: { name: 'answer', value: 42 }, disabled: false },
      ], edges: [{ id: 'child-edge', source: 'child-start', target: 'child-set' }],
    };
    const parent: Workflow = {
      schemaVersion: 1, id: 'mapped-parent', name: 'Mapped parent', variables: [],
      nodes: [
        { id: 'parent-start', type: 'start', label: 'Start', position: { x: 0, y: 0 }, config: {}, disabled: false },
        { id: 'call', type: 'subworkflow', label: 'Call child', position: { x: 0, y: 1 }, config: { workflow: child, outputs: { childAnswer: 'answer' } }, disabled: false },
        { id: 'log', type: 'log', label: 'Log mapped value', position: { x: 0, y: 2 }, config: { message: '{{variables.childAnswer}}' }, disabled: false },
      ], edges: [{ id: 'parent-edge-1', source: 'parent-start', target: 'call' }, { id: 'parent-edge-2', source: 'call', target: 'log' }],
    };
    const result = await executeWorkflow(parent);
    expect(result.status).toBe('succeeded');
    expect(result.variables.childAnswer).toBe(42);
    expect(result.logs).toContain('42');
  });
  it('rejects invalid subworkflow output mappings', () => {
    const invalid: Workflow = {
      ...workflow,
      nodes: workflow.nodes.map((node) => node.id === 'log' ? { ...node, type: 'subworkflow' as const, config: { workflow, outputs: { '__proto__': 'safe', target: 7 } } } : node),
    };
    expect(validateWorkflow(invalid).errors.join(' ')).toContain('output mapping for target must name a valid child variable');
  });
  it('validates required browser selectors and select values before execution', () => {
    const invalid: Workflow = {
      ...workflow,
      nodes: workflow.nodes.map((node) => node.id === 'log' ? { ...node, type: 'selectOption' as const, config: { selector: '', value: 7 } } : node),
    };
    expect(validateWorkflow(invalid).errors.join(' ')).toContain('selector must be a non-empty string');
    expect(validateWorkflow(invalid).errors.join(' ')).toContain('value must be a string');
  });
  it('rejects invalid scraping field maps and pagination bounds', () => {
    const invalid: Workflow = {
      ...workflow,
      nodes: workflow.nodes.map((node) => node.id === 'log' ? { ...node, type: 'extractItems' as const, config: { itemSelector: '.card', fields: { title: '' }, maxPages: 101 } } : node),
    };
    const errors = validateWorkflow(invalid).errors.join(' ');
    expect(errors).toContain('fields must map non-empty names to CSS selectors');
    expect(errors).toContain('maxPages must be an integer from 1 to 100');
  });
  it('rejects an unconfigured or invalid embedded subworkflow', () => {
    const incomplete: Workflow = {
      ...workflow,
      nodes: workflow.nodes.map((node) => node.id === 'log' ? { ...node, type: 'subworkflow' as const, config: { workflow: null, inputs: [] } } : node),
    };
    const errors = validateWorkflow(incomplete).errors.join(' ');
    expect(errors).toContain('workflow must be a configured workflow object');
    expect(errors).toContain('inputs must be an object');
  });
  it('rejects invalid loop output handles', () => {
    const invalid: Workflow = { ...workflow, nodes: [...workflow.nodes, { id: 'loop', type: 'forEach', label: 'Loop', position: { x: 0, y: 0 }, config: {}, disabled: false }], edges: [...workflow.edges, { id: 'loop-edge', source: 'loop', target: 'log', sourceHandle: 'other' }] };
    expect(validateWorkflow(invalid).errors.join(' ')).toContain('item or done');
  });
  it('passes connections through disabled nodes without executing them', async () => {
    const disabled: Workflow = {
      ...workflow,
      nodes: workflow.nodes.map((node) => node.id === 'set' ? { ...node, disabled: true } : node),
    };
    const result = await executeWorkflow(disabled);
    expect(result.status).toBe('succeeded');
    expect(result.steps.map((step) => step.nodeId)).toEqual(['start', 'log']);
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
    const changed = { ...workflow, nodes: workflow.nodes.map((node) => node.id === 'log' ? { ...node, type: 'openUrl' as const, config: { url: 'https://example.com' } } : node) };
    const registry = new ActionRegistry();
    registry.register('start', async () => undefined);
    const result = await executeWorkflow(changed, registry);
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
  it('bounds concurrency while preserving input result order', async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await runBatch([30, 10, 20], async (value) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, value === 30 ? 15 : 1));
      active--;
      return value;
    }, { concurrency: 2 });
    expect(maximumActive).toBe(2);
    expect(results.map((item) => item.output)).toEqual([30, 10, 20]);
  });
});


describe('text and CSV formats', () => {
  it('parses quoted CSV cells and escapes output', () => {
    const rows = parseCsv('name,notes\r\nAda,"hello, world"\r\nLin,"said ""hi"""');
    expect(rows[0].notes).toBe('hello, world');
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
  it('preserves original line numbers for text input', () => {
    expect(parseTextLines('first\n\nthird')).toEqual([{ lineNumber: 1, text: 'first' }, { lineNumber: 3, text: 'third' }]);
  });
});
