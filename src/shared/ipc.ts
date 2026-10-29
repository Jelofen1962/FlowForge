import type { ElementSnapshot, RecordedAction } from '../automation/chromeSession';
import type { RunResult } from '../workflow/engine';

export interface RunHistoryEntry { id: string; workflowName: string; startedAt: string; durationMs: number; status: RunResult['status']; steps: number; error?: string }
export interface BatchJobResult { index: number; status: 'succeeded' | 'failed' | 'cancelled'; steps: number; error?: string; updatedAt: string }
export interface BatchJobSummary { id: string; workflowName: string; itemVariable: string; total: number; status: 'queued' | 'running' | 'failed' | 'cancelled' | 'succeeded'; results: BatchJobResult[]; createdAt: string; updatedAt: string }

export interface FlowForgeApi {
  appVersion: () => Promise<string>;
  loadWorkflow: () => Promise<unknown | null>;
  saveWorkflow: (workflow: unknown) => Promise<{ ok: boolean; path?: string; error?: string; workflow?: unknown }>;
  runWorkflow: (workflow: unknown, runId: string) => Promise<RunResult>;
  getRunHistory: () => Promise<RunHistoryEntry[]>;
  startBatch: (workflow: unknown, items: unknown[], itemVariable: string) => Promise<BatchJobSummary>;
  resumeBatch: (jobId: string) => Promise<BatchJobSummary>;
  listBatchJobs: () => Promise<BatchJobSummary[]>;
  cancelBatch: (jobId: string) => Promise<boolean>;
  onBatchProgress: (listener: (job: BatchJobSummary) => void) => () => void;
  cancelWorkflow: (runId: string) => Promise<boolean>;
  resumeWorkflow: (runId: string, step?: boolean) => Promise<boolean>;
  onDebugPause: (listener: (event: { runId: string; nodeId: string }) => void) => () => void;
  chooseInputFile: () => Promise<{ path: string; content: string } | null>;
  writeOutput: (filename: string, content: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  browser: {
    list: () => Promise<import('../automation/browsers').BrowserInfo[]>;
    start: (browserId?: string) => Promise<{ ok: boolean; error?: string }>;
    stop: () => Promise<{ ok: boolean; error?: string }>;
    status: () => Promise<boolean>;
    navigate: (url: string) => Promise<{ ok: boolean; url?: string; title?: string; error?: string }>;
    selectElement: () => Promise<{ ok: boolean; element?: ElementSnapshot; error?: string }>;
    recordNextAction: () => Promise<{ ok: boolean; action?: RecordedAction; error?: string }>;
    previewItems: (itemSelector: string, fields: Record<string, string>) => Promise<{ ok: boolean; rows?: Record<string, string>[]; error?: string }>;
    testLocator: (strategy: string, value: string, frameSelector?: string) => Promise<{ ok: boolean; matches?: number; firstText?: string; error?: string }>;
  };
}
