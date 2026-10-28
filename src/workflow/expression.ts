const EXPRESSION = /^\{\{\s*([A-Za-z_][A-Za-z0-9_.\[\]]*)\s*\}\}$/;

function readPath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (['__proto__', 'prototype', 'constructor'].includes(part) || current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) {
      throw new Error(`Unresolved expression path: ${path}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function resolveExpression(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const match = value.match(EXPRESSION);
    return match ? readPath(match[1], context) : value;
  }
  if (Array.isArray(value)) return value.map((entry) => resolveExpression(entry, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveExpression(entry, context)]));
  }
  return value;
}
