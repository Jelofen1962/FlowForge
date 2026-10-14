import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React unit tests run in jsdom, not inside the Tauri WebView. Stub the Tauri
// event bridge so mounting App does not call missing __TAURI_INTERNALS__.
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
  emit: vi.fn(async () => {}),
}));

// Vitest runs with globals disabled, so Testing Library cannot discover the
// global afterEach hook automatically. Clean up each rendered React tree to
// prevent duplicate app shells leaking between tests.
afterEach(() => {
  cleanup();
});
