import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

export function Dialog({ open, onClose, labelledBy, children, className, position = "center", dismissible = true }: {
  open: boolean; onClose: () => void; labelledBy: string; children: ReactNode; className?: string; position?: "center" | "top"; dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open, dismissible]);

  if (!open) return null;
  return (
    <div
      className={cx("overlay", position === "top" && "overlay-top")}
      role="presentation"
      onMouseDown={e => { if (dismissible && e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} className={cx("dialog", className)} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
