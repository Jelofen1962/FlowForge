import type { ElementSnapshot } from '../automation/chromeSession';
import type { RunResult } from '../workflow/engine';

export interface FlowForgeApi {
  appVersion: () => Promise<string>;
  loadWorkflow: () => Promise<unknown | null>;
  saveWorkflow: (workflow: unknown) => Promise<{ ok: boolean; path?: string; error?: string }>;
  runWorkflow: (workflow: unknown, runId: string) => Promise<RunResult>;
  cancelWorkflow: (runId: string) => Promise<boolean>;
  chooseInputFile: () => Promise<{ path: string; content: string } | null>;
  writeOutput: (filename: string, content: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  browser: {
    start: () => Promise<{ ok: boolean; error?: string }>;
    stop: () => Promise<{ ok: boolean; error?: string }>;
    status: () => Promise<boolean>;
    navigate: (url: string) => Promise<{ ok: boolean; url?: string; title?: string; error?: string }>;
    selectElement: () => Promise<{ ok: boolean; element?: ElementSnapshot; error?: string }>;
    testLocator: (strategy: string, value: string) => Promise<{ ok: boolean; matches?: number; firstText?: string; error?: string }>;
  };
}
