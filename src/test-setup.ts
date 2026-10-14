import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs with globals disabled, so Testing Library cannot discover the
// global afterEach hook automatically. Clean up each rendered React tree to
// prevent duplicate app shells leaking between tests.
afterEach(() => {
  cleanup();
});
