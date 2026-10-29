import { describe, expect, it } from 'vitest';
import { detectJsonFields, parseJson } from '../src/data/jsonFields';

describe('large JSON field detection', () => {
  it('handles 20,000 records without losing common fields', () => {
    const source = JSON.stringify(Array.from({ length: 20_000 }, (_, id) => ({ id, url: `https://example.com/${id}`, meta: { active: id % 2 === 0 } })));
    const fields = detectJsonFields(parseJson(source));
    expect(fields.map((field) => field.path)).toContain('url');
    expect(fields.map((field) => field.path)).toContain('meta.active');
  });
});
