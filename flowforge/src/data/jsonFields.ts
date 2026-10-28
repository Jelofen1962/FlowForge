export interface DetectedField { path: string; types: string[]; present: number; total: number; isArray: boolean; example?: unknown }

function kind(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

export function detectJsonFields(input: unknown): DetectedField[] {
  const records = Array.isArray(input) ? input : [input];
  const found = new Map<string, { types: Set<string>; present: number; isArray: boolean; example?: unknown }>();
  const visit = (value: unknown, prefix: string) => {
    if (value === null || typeof value !== 'object') {
      const key = prefix || '$';
      const entry = found.get(key) ?? { types: new Set<string>(), present: 0, isArray: false, example: value };
      entry.types.add(kind(value)); entry.present++; found.set(key, entry); return;
    }
    if (Array.isArray(value)) {
      const key = prefix || '$';
      const entry = found.get(key) ?? { types: new Set<string>(), present: 0, isArray: true, example: value[0] };
      entry.types.add('array'); entry.present++; entry.isArray = true; found.set(key, entry);
      value.slice(0, 1).forEach((child) => visit(child, `${key}[]`));
      return;
    }
    if (prefix) {
      const entry = found.get(prefix) ?? { types: new Set<string>(), present: 0, isArray: false, example: value };
      entry.types.add('object'); entry.present++; found.set(prefix, entry);
    }
    for (const [name, child] of Object.entries(value)) visit(child, prefix ? `${prefix}.${name}` : name);
  };
  for (const record of records) visit(record, '');
  return [...found.entries()].map(([path, value]) => ({ path, types: [...value.types].sort(), present: value.present, total: records.length, isArray: value.isArray, example: value.example }));
}

export function parseJson(text: string): unknown {
  try { return JSON.parse(text) as unknown; }
  catch (error) { throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
}
