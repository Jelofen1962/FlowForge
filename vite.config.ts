import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5173, strictPort: true },
  test: {
    // Engine/core tests run in Node; UI tests opt into jsdom with `// @vitest-environment jsdom`.
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/ui/setup.ts"],
  },
});
