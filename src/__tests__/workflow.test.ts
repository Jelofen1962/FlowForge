import { describe, expect, it } from 'vitest';
import { filterRecords, getPath, isWorkflowStep, nextStepId, parseJsonOrNdjson, readWorkflowDraft, safeFilename, validateHttpUrl, bindWorkflowVariables, resolveStepTimeout, validateWorkflowSteps } from '../workflow';

const steps = [{ id: 2, type: 'click', title: 'Click', detail: 'button.ok', enabled: true, breakpoint: false }];
describe('workflow validation and persistence', () => {
  it('validates workflow steps and rejects malformed steps', () => {
    expect(isWorkflowStep(steps[0])).toBe(true);
    expect(isWorkflowStep({ ...steps[0], id: 0 })).toBe(false);
    expect(isWorkflowStep({ ...steps[0], enabled: 'yes' })).toBe(false);
  });
  it('loads valid drafts and safely rejects invalid JSON', () => {
    expect(readWorkflowDraft(JSON.stringify({ name: 'Test', steps }))?.name).toBe('Test');
    expect(readWorkflowDraft('{broken')).toBeNull();
    expect(readWorkflowDraft(JSON.stringify({ steps: [{ id: 'bad' }] }))).toBeNull();
    expect(readWorkflowDraft(null)).toBeNull();
  });
  it('allocates the next ID and sanitizes filenames', () => {
    expect(nextStepId(steps)).toBe(3);
    expect(safeFilename(' Hello world! ')).toBe('Hello-world.json');
    expect(safeFilename('!!!')).toBe('cobweb-workflow.json');
  });
  it('validates HTTP(S) URLs', () => {
    expect(validateHttpUrl('https://example.com')).toBeNull();
    expect(validateHttpUrl('javascript:alert(1)')).toContain('HTTP or HTTPS');
    expect(validateHttpUrl('not a url')).toContain('valid URL');
    expect(validateHttpUrl('https://user:pass@example.com')).toContain('credentials');
  });
});
describe('JSON/NDJSON engine', () => {
  const rows = [{ user: { name: 'Alice', age: 29 }, tags: ['a', 'b'] }, { user: { name: 'Bob', age: 19 }, tags: ['b'] }];
  it('parses JSON arrays, single objects, NDJSON and empty input', () => {
    expect(parseJsonOrNdjson('[1,2]')).toEqual([1, 2]);
    expect(parseJsonOrNdjson('{"a":1}')).toEqual([{ a: 1 }]);
    expect(parseJsonOrNdjson('{"a":1}\n{"a":2}')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseJsonOrNdjson('')).toEqual([]);
  });
  it('reports the bad NDJSON line', () => {
    expect(() => parseJsonOrNdjson('{"a":1}\nnope')).toThrow('line 2');
  });
  it('resolves nested and array paths without throwing', () => {
    expect(getPath({ user: { name: 'Alice' }, list: [{ n: 4 }] }, 'list[0].n')).toBe(4);
    expect(getPath(rows[0], 'user.missing')).toBeUndefined();
    expect(getPath(null, 'x')).toBeUndefined();
  });
  it('filters nested values, numeric ranges, contains, exists, regex and in', () => {
    expect(filterRecords(rows, 'user.age', '>', '20')).toHaveLength(1);
    expect(filterRecords(rows, 'user.name', '==', 'Alice')).toHaveLength(1);
    expect(filterRecords(rows, 'tags', 'contains', 'a')).toHaveLength(1);
    expect(filterRecords(rows, 'user.age', 'exists', '')).toHaveLength(2);
    expect(filterRecords(rows, 'user.name', 'regex', '^B')).toHaveLength(1);
    expect(filterRecords(rows, 'user.name', 'in', '["Alice"]')).toHaveLength(1);
    expect(filterRecords(rows, 'user.age', '???', '20')).toHaveLength(0);
  });
});


describe('production workflow guards', () => {
  it('binds nested row variables without evaluating expressions', () => {
    expect(bindWorkflowVariables('Hello {{ user.name }} / {{orders[0].id}} / {{missing}}', {
      user: { name: 'Ada' }, orders: [{ id: 42 }]
    })).toBe('Hello Ada / 42 / ');
    expect(bindWorkflowVariables('{{x}}', { x: { ok: true } })).toBe('{"ok":true}');
  });
  it('applies a valid per-step timeout before the default and clamps unsafe values', () => {
    expect(resolveStepTimeout(2500, 10000)).toBe(2500);
    expect(resolveStepTimeout(undefined, 10000)).toBe(10000);
    expect(resolveStepTimeout(999999, 10000)).toBe(120000);
    expect(resolveStepTimeout(-1, 0)).toBe(10000);
  });
  it('detects malformed steps and duplicate IDs', () => {
    expect(validateWorkflowSteps(steps)).toEqual([]);
    expect(validateWorkflowSteps([...steps, { ...steps[0] }])).toContain('Step ID 2 is duplicated.');
    expect(validateWorkflowSteps('bad')).toEqual(['Steps must be an array.']);
  });
});
