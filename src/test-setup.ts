import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not provide the native Tauri bridge; mock its event API for UI tests.
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
