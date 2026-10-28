/// <reference types="vite/client" />
import type { FlowForgeApi } from '../shared/ipc';
declare global { interface Window { flowforge?: FlowForgeApi } }
