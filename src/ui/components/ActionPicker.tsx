import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import type { StepType } from "../../core/workflow";
import { actionGroups, getActionIcon, stepTypes } from "../data/actionCatalog";
import { Icon } from "./Icon";
import { cx } from "./cx";

export function ActionPicker({ value, onChange, t, compact, label }: {
  value: StepType; onChange: (v: StepType) => void; t: (k: string) => string; compact?: boolean; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actionGroups
      .map(group => ({
        label: group.label,
        items: stepTypes.filter(([type]) => group.types.includes(type)).filter(([type, text]) => !q || `${t(text)} ${text} ${type}`.toLowerCase().includes(q))
      }))
      .filter(g => g.items.length > 0);
  }, [query, t]);

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const place = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 260 && above > below;
    const width = Math.max(r.width, 300);
    const rtl = document.documentElement.dir === "rtl";
    const left = Math.min(Math.max(8, rtl ? r.right - width : r.left), window.innerWidth - width - 8);
    setPos({ left, width, top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined, maxHeight: Math.min(380, up ? above : below) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    setActive(Math.max(0, flat.findIndex(([type]) => type === value)));
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    const onPointer = (e: MouseEvent) => {
      if (popover.current?.contains(e.target as Node) || trigger.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("mousedown", onPointer); };
  }, [open]);

  const choose = (type: StepType) => {
    onChange(type);
    setOpen(false);
    trigger.current?.focus();
  };

  const selectedLabel = t(stepTypes.find(([type]) => type === value)?.[1] ?? value);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={cx("picker-trigger", compact && "is-compact")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selectedLabel}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="picker-glyph"><Icon icon={getActionIcon(value)} size={compact ? 13 : 15} anim="pop" /></span>
        <span className="picker-label">{selectedLabel}</span>
        <Icon icon={ChevronDown} size={14} />
      </button>
      {open && pos && createPortal(
        <div ref={popover} className="popover" style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}>
          <div className="popover-search">
            <Icon icon={Search} size={15} />
            <input ref={searchRef} placeholder={t("Search actions…")} value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="popover-list" role="listbox">
            {groups.length === 0 && <div className="popover-empty">{t("No matching actions.")}</div>}
            {groups.map(group => (
              <div key={group.label}>
                <div className="popover-group">{t(group.label)}</div>
                {group.items.map(([type, text]) => (
                  <button key={type} type="button" role="option" aria-selected={type === value} className="popover-option" onClick={() => choose(type)}>
                    <span className="opt-glyph"><Icon icon={getActionIcon(type)} size={14} /></span>
                    <span>{t(text)}</span>
                    <Icon icon={Check} size={14} className="opt-check" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
