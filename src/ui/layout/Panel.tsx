import type { CSSProperties, ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, ChevronsDown, ChevronsUp, X, type LucideIcon } from "lucide-react";
import { Icon, IconButton, cx } from "../components";

export function Panel({
  title, icon, side, collapsed, onToggleCollapsed, onHide, labels, badge, actions, style, className, children
}: {
  title: string; icon: LucideIcon; side: "start" | "end" | "bottom"; collapsed: boolean;
  onToggleCollapsed: () => void; onHide: () => void; labels: { collapse: string; expand: string; hide: string };
  badge?: ReactNode; actions?: ReactNode; style?: CSSProperties; className?: string; children: ReactNode;
}) {
  const sideways = side !== "bottom";
  const ExpandIcon = side === "start" ? ChevronsRight : ChevronsLeft;
  const CollapseIcon = side === "start" ? ChevronsLeft : ChevronsRight;

  if (collapsed && sideways) {
    return (
      <aside className={cx("panel", "panel-rail", className)} style={{ width: 40 }} aria-label={title}>
        <IconButton icon={ExpandIcon} label={labels.expand} size="sm" onClick={onToggleCollapsed} iconAnim="nudge" className="rtl-flip" tipSide="end" />
        <Icon icon={icon} size={16} />
        <span className="panel-rail-title">{title}</span>
      </aside>
    );
  }

  return (
    <section className={cx("panel", className)} style={style} aria-label={title}>
      <header className="panel-head">
        <h2 className="panel-title">
          <Icon icon={icon} size={15} />
          {title}
        </h2>
        {badge}
        <span className="grow" />
        {actions}
        <IconButton
          icon={sideways ? CollapseIcon : collapsed ? ChevronsUp : ChevronsDown}
          label={collapsed ? labels.expand : labels.collapse}
          size="sm"
          iconAnim={sideways ? "nudge" : collapsed ? "bounce" : "drop"}
          className={sideways ? "rtl-flip" : undefined}
          tipSide="end"
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        />
        <IconButton icon={X} label={labels.hide} size="sm" iconAnim="rotate" tipSide="end" onClick={onHide} />
      </header>
      {!collapsed && <div className="panel-body">{children}</div>}
    </section>
  );
}
