import { describe, expect, it } from 'vitest';
import { parseWorkflowYaml, stringifyWorkflowYaml, validateWorkflowDocument, type WorkflowDocument } from '../workflowYaml';

const workflow: WorkflowDocument = {
  schemaVersion: 1,
  app: 'Cobweb' as const,
  name: 'Smoke test',
  startingUrl: 'https://example.com',
  settings: { headless: true, liveDebugging: false },
  steps: [{ id: 1, type: 'navigate', title: 'Go to URL', detail: 'https://example.com', enabled: true, breakpoint: false }],
};

describe('workflow YAML', () => {
  it('round-trips a valid workflow', () => {
    const yaml = stringifyWorkflowYaml(workflow);
    expect(yaml).toContain('schemaVersion: 1');
    expect(parseWorkflowYaml(yaml)).toMatchObject(workflow);
  });

  it('rejects malformed YAML with a useful error', () => {
    expect(() => parseWorkflowYaml('schemaVersion: [')).toThrow(/Could not parse workflow YAML/);
  });

  it('rejects unsupported schema versions and invalid URLs', () => {
    const result = validateWorkflowDocument({ ...workflow, schemaVersion: 2, startingUrl: 'javascript:alert(1)' });
    expect(result.document).toBeNull();
    expect(result.errors.join(' ')).toMatch(/schemaVersion must be 1/);
    expect(result.errors.join(' ')).toMatch(/HTTP or HTTPS/);
  });

  it('rejects duplicate step IDs', () => {
    const duplicate = { ...workflow, steps: [...workflow.steps, { ...workflow.steps[0], title: 'Duplicate' }] };
    expect(() => stringifyWorkflowYaml(duplicate)).toThrow(/duplicated/);
  });

  it('does not allow YAML aliases', () => {
    const source = 'schemaVersion: 1\nname: x\nstartingUrl: https://example.com\nsteps: &steps []\nother: *steps';
    expect(() => parseWorkflowYaml(source)).toThrow();
  });
});
