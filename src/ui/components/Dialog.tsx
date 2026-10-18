import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  position?: "center" | "top";
  dismissible?: boolean;
};

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog with: focus moved in on open (prefers [data-autofocus]), Tab trapping,
 * Escape to dismiss, backdrop click to dismiss, and focus restored on close.
 */
export function Dialog({ open, onClose, labelledBy, children, className, position = "center", dismissible = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (node?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? node)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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
      onMouseDown={event => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={cx("dialog", className)} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
