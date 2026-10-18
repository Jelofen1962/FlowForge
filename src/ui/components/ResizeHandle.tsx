import type { KeyboardEvent, PointerEvent } from "react";
import { clamp, cx } from "./cx";

type Props = {
  /** "vertical" = a vertical bar between side-by-side panes (resizes width). "horizontal" = bar above a bottom dock (resizes height). */
  orientation?: "vertical" | "horizontal";
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onReset?: () => void;
  label: string;
  /** Dragging toward the inline-end shrinks the pane (true for end-side panes, and for start-side panes in RTL). */
  invert?: boolean;
};

/**
 * Accessible splitter: pointer drag (with capture), arrow keys (Shift = bigger steps),
 * Home/End for min/max, Enter or double-click to reset.
 */
export function ResizeHandle({ orientation = "vertical", value, min, max, onChange, onReset, label, invert = false }: Props) {
  const vertical = orientation === "vertical";
  const bodyClass = vertical ? "is-resizing" : "is-resizing-y";

  const down = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { pos: vertical ? event.clientX : event.clientY, size: value };
    document.body.classList.add(bodyClass);
    const el = event.currentTarget;
    const move = (e: globalThis.PointerEvent) => {
      const current = vertical ? e.clientX : e.clientY;
      let delta = current - start.pos;
      if (!vertical) delta = -delta;
      else if (invert) delta = -delta;
      onChange(clamp(Math.round(start.size + delta), min, max));
    };
    const up = (e: globalThis.PointerEvent) => {
      document.body.classList.remove(bodyClass);
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    let direction = 0;
    if (vertical) {
      if (event.key === "ArrowRight") direction = invert ? -1 : 1;
      if (event.key === "ArrowLeft") direction = invert ? 1 : -1;
    } else {
      if (event.key === "ArrowUp") direction = 1;
      if (event.key === "ArrowDown") direction = -1;
    }
    if (direction) {
      event.preventDefault();
      onChange(clamp(value + direction * step, min, max));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(max);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onReset?.();
    }
  };

  return (
    <div
      className={cx("handle", vertical ? "handle-v" : "handle-h")}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={down}
      onKeyDown={key}
      onDoubleClick={onReset}
    />
  );
}
