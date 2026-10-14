import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit cleanup prevents rendered React trees leaking between tests.
afterEach(() => {
  cleanup();
});
