declare global {
  interface Window {
    flowforge: {
      start: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
      stop: () => Promise<{ ok: boolean; error?: string }>;
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
