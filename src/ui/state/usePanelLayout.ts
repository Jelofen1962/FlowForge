import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../components/cx";

export type PanelId = "steps" | "run" | "dock";
export type PanelState = { size: number; open: boolean; collapsed: boolean };
export type Layout = { navExpanded: boolean; steps: PanelState; run: PanelState; dock: PanelState };

export const STORAGE_KEY = "flowforge.layout.v2";

/** Width (steps, run) or height (dock) limits in CSS pixels. */
export const LIMITS: Record<PanelId, { min: number; max: number }> = {
  steps: { min: 240, max: 520 },
  run: { min: 280, max: 520 },
  dock: { min: 120, max: 560 },
};

export const DEFAULT_LAYOUT: Layout = {
  navExpanded: true,
  steps: { size: 300, open: true, collapsed: false },
  run: { size: 332, open: true, collapsed: false },
  dock: { size: 210, open: true, collapsed: false },
};

const sanitizePanel = (id: PanelId, value: unknown): PanelState => {
  const fallback = DEFAULT_LAYOUT[id];
  if (!value || typeof value !== "object") return fallback;
  const v = value as Partial<PanelState>;
  return {
    size: clamp(Number(v.size) || fallback.size, LIMITS[id].min, LIMITS[id].max),
    open: typeof v.open === "boolean" ? v.open : fallback.open,
    collapsed: typeof v.collapsed === "boolean" ? v.collapsed : fallback.collapsed,
  };
};

/** Parses stored layout JSON defensively; falls back to defaults for anything invalid. */
export function parseLayout(raw: string | null): Layout {
  if (!raw) return DEFAULT_LAYOUT;
  try {
    const value = JSON.parse(raw) as Partial<Layout>;
    return {
      navExpanded: typeof value.navExpanded === "boolean" ? value.navExpanded : DEFAULT_LAYOUT.navExpanded,
      steps: sanitizePanel("steps", value.steps),
      run: sanitizePanel("run", value.run),
      dock: sanitizePanel("dock", value.dock),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function loadLayout(): Layout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return parseLayout(stored);
    // Migrate the widths saved by the previous (v1) layout.
    const steps = Number(localStorage.getItem("flowforge.stepsWidth.v1"));
    const run = Number(localStorage.getItem("flowforge.rightWidth.v1"));
    return {
      ...DEFAULT_LAYOUT,
      steps: { ...DEFAULT_LAYOUT.steps, size: steps ? clamp(steps, LIMITS.steps.min, LIMITS.steps.max) : DEFAULT_LAYOUT.steps.size },
      run: { ...DEFAULT_LAYOUT.run, size: run ? clamp(run, LIMITS.run.min, LIMITS.run.max) : DEFAULT_LAYOUT.run.size },
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/**
 * Workspace layout state: every panel can be resized, collapsed to a rail, or hidden entirely.
 * Persisted in localStorage so the workspace reopens the way you left it.
 */
export function usePanelLayout() {
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const snapshot = useRef<Layout | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* storage unavailable */ }
  }, [layout]);

  const patch = useCallback((id: PanelId, change: Partial<PanelState>) => setLayout(current => ({ ...current, [id]: { ...current[id], ...change } })), []);

  const setSize = useCallback((id: PanelId, size: number) => patch(id, { size: clamp(Math.round(size), LIMITS[id].min, LIMITS[id].max) }), [patch]);
  const resetSize = useCallback((id: PanelId) => patch(id, { size: DEFAULT_LAYOUT[id].size }), [patch]);
  const reveal = useCallback((id: PanelId) => patch(id, { open: true, collapsed: false }), [patch]);
  const hide = useCallback((id: PanelId) => patch(id, { open: false }), [patch]);
  const toggleOpen = useCallback(
    (id: PanelId) => setLayout(current => ({ ...current, [id]: current[id].open ? { ...current[id], open: false } : { ...current[id], open: true, collapsed: false } })),
    []
  );
  const toggleCollapsed = useCallback((id: PanelId) => setLayout(current => ({ ...current, [id]: { ...current[id], collapsed: !current[id].collapsed } })), []);
  const toggleNav = useCallback(() => setLayout(current => ({ ...current, navExpanded: !current.navExpanded })), []);

  const focusMode = !layout.steps.open && !layout.run.open && !layout.dock.open;
  const toggleFocus = useCallback(() => {
    setLayout(current => {
      const allHidden = !current.steps.open && !current.run.open && !current.dock.open;
      if (allHidden) {
        const restore = snapshot.current ?? DEFAULT_LAYOUT;
        snapshot.current = null;
        return { ...current, steps: { ...restore.steps, open: true }, run: { ...restore.run, open: true }, dock: { ...restore.dock, open: true } };
      }
      snapshot.current = current;
      return { ...current, steps: { ...current.steps, open: false }, run: { ...current.run, open: false }, dock: { ...current.dock, open: false } };
    });
  }, []);

  const resetLayout = useCallback(() => {
    snapshot.current = null;
    setLayout(DEFAULT_LAYOUT);
  }, []);

  return { layout, setSize, resetSize, reveal, hide, toggleOpen, toggleCollapsed, toggleNav, focusMode, toggleFocus, resetLayout };
}

export type PanelLayoutApi = ReturnType<typeof usePanelLayout>;
