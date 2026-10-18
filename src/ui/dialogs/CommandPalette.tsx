import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, Search, type LucideIcon } from "lucide-react";
import { Dialog, Icon, Kbd, cx } from "../components";

export type PaletteCommand = { id: string; group: string; label: string; detail: string; icon: LucideIcon; shortcut?: string; run: () => void };
type Props = { open: boolean; onClose: () => void; t: (text: string) => string; commands: PaletteCommand[]; query: string; onQuery: (value: string) => void };

/** Ctrl+K palette: type to filter, ↑/↓ to move, Enter to run the highlighted command. */
export function CommandPalette({ open, onClose, t, commands, query, onQuery }: Props) {
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return commands.filter(item => !needle || `${t(item.label)} ${t(item.detail)} ${t(item.group)}`.toLowerCase().includes(needle));
  }, [commands, query, t]);

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => {
    if (open) document.getElementById(`cmd-${filtered[active]?.id}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, filtered]);

  const run = (item: PaletteCommand | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(i => (filtered.length ? (i + 1) % filtered.length : 0)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0)); }
    else if (event.key === "Enter") { event.preventDefault(); run(filtered[active]); }
  };

  let lastGroup = "";
  return (
    <Dialog open={open} onClose={onClose} labelledBy="command-title" position="top" className="dialog-flush dialog-lg">
      <h2 id="command-title" className="sr-only">{t("COMMAND PALETTE")}</h2>
      <div className="cmd-search">
        <Icon icon={Search} size={18} />
        <input
          data-autofocus
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          aria-activedescendant={filtered[active] ? `cmd-${filtered[active].id}` : undefined}
          value={query}
          onChange={event => onQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("Search commands…")}
          aria-label={t("Search commands…")}
        />
        <Kbd>ESC</Kbd>
      </div>
      <div className="cmd-list" id="cmd-list" role="listbox" aria-label={t("Commands")}>
        {filtered.length === 0 && <div className="cmd-empty">{t("No matching commands.")}</div>}
        {filtered.map((item, index) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <div key={item.id} role="presentation">
              {header && <div className="popover-group" role="presentation">{t(header)}</div>}
              <button id={`cmd-${item.id}`} type="button" role="option" tabIndex={-1} aria-selected={index === active} data-active={index === active} className={cx("cmd-item")} onMouseEnter={() => setActive(index)} onClick={() => run(item)}>
                <span className="cmd-glyph"><Icon icon={item.icon} size={15} anim="pop" /></span>
                <span className="cmd-copy"><strong>{t(item.label)}</strong><small>{t(item.detail)}</small></span>
                {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                {index === active && <Icon icon={CornerDownLeft} size={14} />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="cmd-foot">
        <span><Kbd>↑</Kbd><Kbd>↓</Kbd> {t("navigate")}</span>
        <span><Kbd>Enter</Kbd> {t("run")}</span>
        <span><Kbd>Ctrl K</Kbd> {t("toggle palette")}</span>
        <span><Kbd>Esc</Kbd> {t("close")}</span>
      </div>
    </Dialog>
  );
}
