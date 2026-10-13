import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type MenuAction = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; icon?: ReactNode };
export function DropdownMenu({ label, icon, actions, className = '' }: {
  label: string; icon: ReactNode; actions: MenuAction[]; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return <div className={'dropdown-root ' + className} ref={root} onClick={event => event.stopPropagation()}>
    <button type="button" className="icon-btn dropdown-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>{icon}</button>
    {open && <div className="menu-popover" role="menu" aria-label={label}>
      {actions.map((action, i) => <button type="button" role="menuitem" key={action.label + i} disabled={action.disabled}
        className={action.danger ? 'menu-danger' : ''} onClick={() => { action.onSelect(); setOpen(false); }}>
        {action.icon}<span>{action.label}</span>
      </button>)}
    </div>}
  </div>;
}
