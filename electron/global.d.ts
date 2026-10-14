export {};
declare global {
  interface Window {
    flowforge: {
      start: (payload: unknown) => Promise<{ok:boolean;error?:string}>;
      stop: () => Promise<{ok:boolean}>;
      saveProfile: (profile: unknown) => Promise<{ok:boolean;path?:string}>;
      listProfiles: () => Promise<string[]>;
      openExternal: (url:string) => void;
      onLog: (callback:(line:string)=>void) => () => void;
      onFinished: (callback:(result:{code:number})=>void) => () => void;
    }
  }
}