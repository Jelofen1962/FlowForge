import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import type { StepType } from "../../core/workflow";
import { actionGroups, getActionIcon, stepTypes } from "../data/actionCatalog";
import { Icon } from "./Icon";
import { cx } from "./cx";

type Props = {
  value: StepType;
  onChange: (value: StepType) => void;
  /** Translation function from the app controller. */
  t: (text: string) => string;
  compact?: boolean;
  label: string;
};

type Position = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/**
 * Searchable, grouped action picker with Lucide icons (replaces the emoji <select>).
 * ARIA combobox pattern: the search input owns focus, options are announced through aria-activedescendant.
 */
export function ActionPicker({ value, onChange, t, compact, label }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (type: string) => `${uid}-opt-${type}`;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return actionGroups
      .map(group => ({
        label: group.label,
        items: stepTypes.filter(([type]) => group.types.includes(type)).filter(([type, text]) => !needle || `${t(text)} ${text} ${type}`.toLowerCase().includes(needle)),
      }))
      .filter(group => group.items.length > 0);
  }, [query, t]);
  const flat = useMemo(() => groups.flatMap(group => group.items), [groups]);

  const place = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const up = below < 300 && above > below;
    const width = Math.max(rect.width, 300);
    const rtl = document.documentElement.dir === "rtl";
    const left = Math.min(Math.max(8, rtl ? rect.right - width : rect.left), window.innerWidth - width - 8);
    setPosition({ left, width, top: up ? undefined : rect.bottom + 6, bottom: up ? window.innerHeight - rect.top + 6 : undefined, maxHeight: Math.min(400, up ? above : below) });
  };

  const close = (restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) trigger.current?.focus();
  };

  const choose = (type: StepType) => {
    onChange(type);
    close();
  };

  useEffect(() => {
    if (!open) return;
    place();
    setActive(Math.max(0, flat.findIndex(([type]) => type === value)));
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popover.current?.contains(target) || trigger.current?.contains(target)) return;
      close(false);
    };
    const onViewport = (event: Event) => {
      if (popover.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open || !flat[active]) return;
    document.getElementById(optionId(flat[active][0]))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, flat]);

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(index => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(index => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, flat.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (flat[active]) choose(flat[active][0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close(false);
    }
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
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selectedLabel}`}
        data-anim-host
        onClick={() => setOpen(current => !current)}
      >
        <span className="picker-glyph">
          <Icon icon={getActionIcon(value)} size={compact ? 13 : 15} anim="pop" />
        </span>
        <span className="picker-label">{selectedLabel}</span>
        <Icon icon={ChevronDown} size={14} />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={popover}
            className="popover"
            style={{ left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}
          >
            <div className="popover-search">
              <Icon icon={Search} size={15} />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={flat[active] ? optionId(flat[active][0]) : undefined}
                aria-label={t("Search actions…")}
                placeholder={t("Search actions…")}
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
              />
            </div>
            <div className="popover-list" id={listId} role="listbox" aria-label={label}>
              {groups.length === 0 && <div className="popover-empty">{t("No matching actions.")}</div>}
              {groups.map(group => (
                <div key={group.label} role="group" aria-label={t(group.label)}>
                  <div className="popover-group" role="presentation">{t(group.label)}</div>
                  {group.items.map(([type, text]) => {
                    const index = flat.findIndex(([candidate]) => candidate === type);
                    return (
                      <button
                        key={type}
                        id={optionId(type)}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={type === value}
                        data-active={index === active}
                        className="popover-option"
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => choose(type)}
                      >
                        <span className="opt-glyph"><Icon icon={getActionIcon(type)} size={14} /></span>
                        <span>{t(text)}</span>
                        <Icon icon={Check} size={14} className="opt-check" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
