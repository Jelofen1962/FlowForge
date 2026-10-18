// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, LIMITS, STORAGE_KEY, parseLayout, usePanelLayout } from "../../src/ui/state/usePanelLayout";

beforeEach(() => localStorage.clear());

describe("parseLayout", () => {
  it("returns defaults for missing or corrupt data", () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout("{not json")).toEqual(DEFAULT_LAYOUT);
  });

  it("clamps sizes into the allowed range and ignores wrong types", () => {
    const layout = parseLayout(JSON.stringify({ steps: { size: 9999, open: "yes" }, run: { size: 1 }, dock: { size: 300, open: false } }));
    expect(layout.steps.size).toBe(LIMITS.steps.max);
    expect(layout.steps.open).toBe(DEFAULT_LAYOUT.steps.open);
    expect(layout.run.size).toBe(LIMITS.run.min);
    expect(layout.dock).toMatchObject({ size: 300, open: false });
  });
});

describe("usePanelLayout", () => {
  it("resizes within limits and resets to the default size", () => {
    const { result } = renderHook(() => usePanelLayout());
    act(() => result.current.setSize("steps", 5000));
    expect(result.current.layout.steps.size).toBe(LIMITS.steps.max);
    act(() => result.current.setSize("steps", 10));
    expect(result.current.layout.steps.size).toBe(LIMITS.steps.min);
    act(() => result.current.resetSize("steps"));
    expect(result.current.layout.steps.size).toBe(DEFAULT_LAYOUT.steps.size);
  });

  it("hides, reveals and collapses panels independently", () => {
    const { result } = renderHook(() => usePanelLayout());
    act(() => result.current.toggleCollapsed("run"));
    expect(result.current.layout.run.collapsed).toBe(true);
    act(() => result.current.toggleOpen("run")); // hide
    expect(result.current.layout.run.open).toBe(false);
    act(() => result.current.toggleOpen("run")); // show again, expanded
    expect(result.current.layout.run).toMatchObject({ open: true, collapsed: false });
    act(() => result.current.hide("dock"));
    expect(result.current.layout.dock.open).toBe(false);
    expect(result.current.layout.steps.open).toBe(true);
  });

  it("focus mode hides every panel and restores the previous layout", () => {
    const { result } = renderHook(() => usePanelLayout());
    act(() => result.current.setSize("steps", 400));
    act(() => result.current.hide("dock"));
    act(() => result.current.toggleFocus());
    expect(result.current.focusMode).toBe(true);
    act(() => result.current.toggleFocus());
    expect(result.current.focusMode).toBe(false);
    expect(result.current.layout.steps).toMatchObject({ open: true, size: 400 });
  });

  it("persists to localStorage and restores on next mount", () => {
    const first = renderHook(() => usePanelLayout());
    act(() => first.result.current.setSize("run", 420));
    act(() => first.result.current.toggleNav());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).run.size).toBe(420);
    first.unmount();
    const second = renderHook(() => usePanelLayout());
    expect(second.result.current.layout.run.size).toBe(420);
    expect(second.result.current.layout.navExpanded).toBe(false);
  });

  it("migrates the widths saved by the previous layout", () => {
    localStorage.setItem("flowforge.stepsWidth.v1", "350");
    localStorage.setItem("flowforge.rightWidth.v1", "9999");
    const { result } = renderHook(() => usePanelLayout());
    expect(result.current.layout.steps.size).toBe(350);
    expect(result.current.layout.run.size).toBe(LIMITS.run.max);
  });

  it("resetLayout restores defaults", () => {
    const { result } = renderHook(() => usePanelLayout());
    act(() => result.current.hide("steps"));
    act(() => result.current.resetLayout());
    expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
  });
});
