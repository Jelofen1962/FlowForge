import { parse, stringify } from 'yaml';
import { isWorkflowStep, validateHttpUrl, validateWorkflowSteps, type WorkflowStep } from './workflow';

export type WorkflowDocument = {
  schemaVersion: 1;
  app?: 'Cobweb';
  name: string;
  startingUrl: string;
  settings?: { headless?: boolean; liveDebugging?: boolean };
  steps: WorkflowStep[];
};

// Small bounded LRU caches keep repeated editor validation/export cheap without
// leaking mutable cached objects into application state.
const YAML_CACHE_LIMIT = 64;
const parsedYamlCache = new Map<string, WorkflowDocument>();
const serializedYamlCache = new Map<string, string>();

function cloneDocument(document: WorkflowDocument): WorkflowDocument {
  return JSON.parse(JSON.stringify(document)) as WorkflowDocument;
}

function remember<T>(cache: Map<string, T>, key: string, value: T): T {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > YAML_CACHE_LIMIT) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return value;
}

export function clearWorkflowYamlCache(): void {
  parsedYamlCache.clear();
  serializedYamlCache.clear();
}

export function getWorkflowYamlCacheStats(): { parsed: number; serialized: number; limit: number } {
  return { parsed: parsedYamlCache.size, serialized: serializedYamlCache.size, limit: YAML_CACHE_LIMIT };
}

export function validateWorkflowDocument(value: unknown): { document: WorkflowDocument | null; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { document: null, errors: ['Workflow YAML must contain a mapping/object at its root.'] };
  }
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (typeof raw.name !== 'string' || !raw.name.trim()) errors.push('name must be a non-empty string.');
  if (typeof raw.startingUrl !== 'string') errors.push('startingUrl must be a URL string.');
  else {
    const urlError = validateHttpUrl(raw.startingUrl);
    if (urlError) errors.push(`startingUrl: ${urlError}`);
  }
  if (!Array.isArray(raw.steps)) errors.push('steps must be an array.');
  else errors.push(...validateWorkflowSteps(raw.steps));
  if (raw.settings !== undefined) {
    if (!raw.settings || typeof raw.settings !== 'object' || Array.isArray(raw.settings)) errors.push('settings must be a mapping.');
    else {
      const settings = raw.settings as Record<string, unknown>;
      for (const key of ['headless', 'liveDebugging']) {
        if (settings[key] !== undefined && typeof settings[key] !== 'boolean') errors.push(`settings.${key} must be a boolean.`);
      }
    }
  }
  if (errors.length) return { document: null, errors };
  const steps = raw.steps as WorkflowStep[];
  if (!steps.every(isWorkflowStep)) return { document: null, errors: ['One or more workflow steps have an invalid shape.'] };
  return {
    document: {
      schemaVersion: 1,
      app: 'Cobweb',
      name: (raw.name as string).trim(),
      startingUrl: (raw.startingUrl as string).trim(),
      settings: raw.settings as WorkflowDocument['settings'],
      steps,
    },
    errors: [],
  };
}

export function parseWorkflowYaml(source: string): WorkflowDocument {
  const cached = parsedYamlCache.get(source);
  if (cached) {
    // Refresh LRU position and return a defensive copy.
    remember(parsedYamlCache, source, cached);
    return cloneDocument(cached);
  }
  let parsed: unknown;
  try {
    parsed = parse(source, { uniqueKeys: true, maxAliasCount: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid YAML syntax.';
    throw new Error(`Could not parse workflow YAML: ${message}`);
  }
  const result = validateWorkflowDocument(parsed);
  if (!result.document) throw new Error(`Invalid workflow YAML:\n- ${result.errors.join('\n- ')}`);
  remember(parsedYamlCache, source, cloneDocument(result.document));
  return cloneDocument(result.document);
}

export function stringifyWorkflowYaml(document: WorkflowDocument): string {
  // JSON is a stable key for this plain workflow data shape. A cache hit means
  // this exact value was already validated and serialized successfully.
  let key: string;
  try { key = JSON.stringify(document); }
  catch { key = ''; }
  if (key) {
    const cached = serializedYamlCache.get(key);
    if (cached !== undefined) {
      remember(serializedYamlCache, key, cached);
      return cached;
    }
  }
  const result = validateWorkflowDocument(document);
  if (!result.document) throw new Error(`Cannot export invalid workflow:\n- ${result.errors.join('\n- ')}`);
  const validatedKey = JSON.stringify(result.document);
  const serialized = stringify(result.document, { lineWidth: 100, sortMapEntries: false });
  return remember(serializedYamlCache, validatedKey, serialized);
}
