declare global {
  interface Window {
    flowforge: {
      start: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
      stop: () => Promise<{ ok: boolean; error?: string }>;
      respondUserInput: (response: { requestId: string; values?: Record<string, string>; cancel?: boolean }) => Promise<{ ok: boolean; error?: string }>;
      sessionExport: () => Promise<{ ok: boolean; error?: string }>;
      sessionImport: (snapshot: unknown) => Promise<{ ok: boolean; error?: string }>;
      recorderStart: (options?: { startUrl?: string; browser?: string; profile?: unknown }) => Promise<{ ok: boolean; error?: string }>;
      recorderStop: () => Promise<{ ok: boolean; error?: string }>;
      recorderNavigate: (url: string) => Promise<{ ok: boolean; error?: string }>;
      saveProfile: (profile: unknown) => Promise<{ ok: boolean; path?: string; error?: string }>;
      listProfiles: () => Promise<string[]>;
      openExternal: (url: string) => Promise<unknown>;
      onLog: (callback: (line: string) => void) => () => void;
      onFinished: (callback: (result: { code: number; signal: string | null; stopped: boolean }) => void) => () => void;
    };
  }
}
export {};
