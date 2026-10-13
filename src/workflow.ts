export type WorkflowStep = { id: number; type: string; title: string; detail: string; enabled: boolean; breakpoint: boolean };

export function isWorkflowStep(value: unknown): value is WorkflowStep {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return Number.isInteger(s.id) && Number(s.id) > 0 && typeof s.type === 'string' &&
    s.type.length > 0 && typeof s.title === 'string' && typeof s.detail === 'string' &&
    typeof s.enabled === 'boolean' && typeof s.breakpoint === 'boolean';
}
export function readWorkflowDraft(raw: string | null): { name: string; steps: WorkflowStep[]; startingUrl?: string; settings?: { headless?: boolean; liveDebugging?: boolean } } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(v.steps) || !v.steps.every(isWorkflowStep)) return null;
    return { name: typeof v.name === 'string' && v.name.trim() ? v.name : 'Untitled workflow', steps: v.steps, startingUrl: typeof v.startingUrl === 'string' ? v.startingUrl : undefined, settings: v.settings && typeof v.settings === 'object' ? v.settings as { headless?: boolean; liveDebugging?: boolean } : undefined };
  } catch { return null; }
}
export function nextStepId(steps: readonly WorkflowStep[]): number {
  return steps.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}
export function safeFilename(name: string): string {
  return (name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cobweb-workflow') + '.json';
}
export function validateHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return 'URL must use HTTP or HTTPS.';
    if (!url.hostname || url.hostname.includes(' ')) return 'Enter a valid hostname.';
    return null;
  } catch { return 'Enter a valid URL, including https://.'; }
}
export function parseJsonOrNdjson(source: string): unknown[] {
  const text = source.trim();
  if (!text) return [];
  try { const value: unknown = JSON.parse(text); return Array.isArray(value) ? value : [value]; }
  catch {
    return text.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
      try { return JSON.parse(line); } catch { throw new Error(`Invalid JSON/NDJSON at line ${i + 1}`); }
    });
  }
}
export function getPath(value: unknown, path: string): unknown {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
  return normalized.split('.').filter(Boolean).reduce<unknown>((current, key) => {
    if (current == null) return undefined;
    if (Array.isArray(current)) return /^\d+$/.test(key) ? current[Number(key)] : undefined;
    if (typeof current === 'object') return (current as Record<string, unknown>)[key];
    return undefined;
  }, value);
}
export function filterRecords(records: unknown[], path: string, operator: string, rawValue: string): unknown[] {
  let expected: unknown = rawValue;
  try { expected = JSON.parse(rawValue); } catch { /* plain string */ }
  return records.filter(record => {
    const actual = getPath(record, path);
    switch (operator) {
      case '==': return actual === expected || (actual != null && expected != null && String(actual) === String(expected));
      case '!=': return !(actual === expected || (actual != null && expected != null && String(actual) === String(expected)));
      case '>': return Number(actual) > Number(expected);
      case '>=': return Number(actual) >= Number(expected);
      case '<': return Number(actual) < Number(expected);
      case '<=': return Number(actual) <= Number(expected);
      case 'contains': return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? '').includes(String(expected));
      case 'regex': try { return new RegExp(String(expected)).test(String(actual ?? '')); } catch { return false; }
      case 'exists': return actual !== undefined && actual !== null;
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      default: return false;
    }
  });
}
