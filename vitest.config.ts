import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    // Keep Vitest focused on frontend unit tests. The Node runner integration
    // suite is executed separately by `npm run test:runner`, and Playwright
    // specs belong to `npm run test:e2e`.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, 'e2e/**', 'tests/**'],
  },
});
