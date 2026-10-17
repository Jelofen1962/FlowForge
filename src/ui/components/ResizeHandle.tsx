import type { KeyboardEvent, PointerEvent } from "react";
import { clamp, cx } from "./cx";

export function ResizeHandle({ orientation = "vertical", value, min, max, onChange, onReset, label, invert = false }: {
  orientation?: "vertical" | "horizontal"; value: number; min: number; max: number; onChange: (v: number) => void; onReset?: () => void; label: string; invert?: boolean;
}) {
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
      try { el.releasePointerCapture(e.pointerId); } catch {}
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
    let dir = 0;
    if (vertical) {
      if (event.key === "ArrowRight") dir = invert ? -1 : 1;
      if (event.key === "ArrowLeft") dir = invert ? 1 : -1;
    } else {
      if (event.key === "ArrowUp") dir = 1;
      if (event.key === "ArrowDown") dir = -1;
    }
    if (dir) {
      event.preventDefault();
      onChange(clamp(value + dir * step, min, max));
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
