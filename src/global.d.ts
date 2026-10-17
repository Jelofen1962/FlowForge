declare global {
  interface Window {
    flowforge: {
      getVersion: () => Promise<string>;
      getAiApiInfo: () => Promise<{ available: boolean; baseUrl: string; token: string; authHeader: string; docsPath: string }>;
      getAiGuidanceActions: () => Promise<Array<{ id?: string; action: string; url?: string; title?: string; target?: { value?: string; text?: string; strategy?: string }; text?: string; value?: string; selectedText?: string; at?: number }>>;
      syncAiWorkflows: (workflows: unknown[]) => Promise<{ ok: boolean; count?: number; error?: string }>;
      checkForUpdates: () => Promise<{ ok: boolean; available: boolean; currentVersion?: string; latestVersion?: string; releaseName?: string; notes?: string; url?: string; publishedAt?: string | null; error?: string }>;
      start: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
      setLaunchAtLogin: (enabled: boolean) => Promise<{ ok: boolean; enabled?: boolean; error?: string }>;
      chooseFile: () => Promise<{ canceled?: boolean; path?: string; error?: string }>;
      stop: () => Promise<{ ok: boolean; error?: string }>;
      respondUserInput: (response: { requestId: string; values?: Record<string, string>; cancel?: boolean }) => Promise<{ ok: boolean; error?: string }>;
      sessionExport: () => Promise<{ ok: boolean; error?: string }>;
      sessionImport: (snapshot: unknown) => Promise<{ ok: boolean; error?: string }>;
      recorderStart: (options?: { startUrl?: string; browser?: string; profile?: unknown }) => Promise<{ ok: boolean; error?: string }>;
      recorderStop: () => Promise<{ ok: boolean; error?: string }>;
      recorderNavigate: (url: string) => Promise<{ ok: boolean; error?: string }>;
      saveProfile: (profile: unknown) => Promise<{ ok: boolean; path?: string; error?: string }>;
      listProfiles: () => Promise<string[]>;
      listOutputs: (workflowId: string) => Promise<Array<{ name: string; path: string; size: number; modifiedAt: string; workflowName: string; runId: string; artifacts: Array<{ name: string; contentType: string; size: number; createdAt: string }> }>>;
      openOutput: (workflowId: string, archiveName: string) => Promise<{ ok: boolean; error?: string }>;
      revealOutput: (workflowId: string, archiveName: string) => Promise<{ ok: boolean; error?: string }>;
      deleteOutput: (workflowId: string, archiveName: string) => Promise<{ ok: boolean; error?: string }>;
      readOutput: (workflowId: string, archiveName: string, artifactName: string) => Promise<{ ok: boolean; error?: string; name?: string; mime?: string; data?: string; text?: string }>;
      openExternal: (url: string) => Promise<unknown>;
      onAiWorkflowUpsert: (callback: (item: { id: string; document: unknown; updatedAt: string; aiTag?: boolean; aiProvenance?: "generated" | "human-guided" | "ai-assisted" }) => void) => () => void;
      onLog: (callback: (line: string) => void) => () => void;
      onFinished: (callback: (result: { code: number; signal: string | null; stopped: boolean }) => void) => () => void;
    };
  }
}
export {};
