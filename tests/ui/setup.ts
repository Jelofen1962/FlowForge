import { afterEach } from "vitest";

// Only wire up DOM helpers when a DOM is present (UI tests use `@vitest-environment jsdom`).
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");
  afterEach(() => cleanup());
  // jsdom lacks these browser APIs used by the UI.
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.matchMedia = window.matchMedia || ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
  // axe-core probes canvas for icon-ligature detection; jsdom has no canvas implementation.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = (globalThis as unknown as { ResizeObserver?: typeof RO }).ResizeObserver || RO;
}
