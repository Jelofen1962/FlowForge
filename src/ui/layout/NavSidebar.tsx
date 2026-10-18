import { Archive, Fingerprint, History, LayoutTemplate, LibraryBig, MousePointerClick, Settings, Sparkles, Terminal, Variable, Workflow, type LucideIcon } from "lucide-react";
import type { AppController } from "../state/useAppController";
import type { PanelLayoutApi } from "../state/usePanelLayout";
import { Badge, Icon, StatusDot, cx, type IconAnim } from "../components";

type Item = { id: string; label: string; icon: LucideIcon; anim: IconAnim; badge?: string };
type Group = { label?: string; items: Item[] };

export const NAV_GROUPS: Group[] = [
  { label: "Build", items: [
    { id: "workflow", label: "Editor", icon: Workflow, anim: "nudge" },
    { id: "variables", label: "Variables", icon: Variable, anim: "pop" },
    { id: "library", label: "Workflows", icon: LibraryBig, anim: "bounce" },
    { id: "templates", label: "Templates", icon: LayoutTemplate, anim: "pop" },
  ] },
  { label: "Run", items: [
    { id: "browser", label: "Browser", icon: MousePointerClick, anim: "pulse" },
    { id: "outputs", label: "Outputs", icon: Archive, anim: "drop" },
    { id: "history", label: "Run history", icon: History, anim: "turn" },
  ] },
  { label: "Setup", items: [
    { id: "profiles", label: "Profiles", icon: Fingerprint, anim: "pop" },
    { id: "settings", label: "Settings", icon: Settings, anim: "turn" },
  ] },
  { items: [{ id: "ai", label: "AI Studio", icon: Sparkles, anim: "pulse", badge: "AI" }] },
];

export function NavSidebar({ app, panels }: { app: AppController; panels: PanelLayoutApi }) {
  const { t, tab, running } = app;
  const expanded = panels.layout.navExpanded;
  const renderItem = (item: Item) => {
    const label = t(item.label);
    return (
      <button
        key={item.id}
        type="button"
        className="nav-item"
        aria-current={tab === item.id ? "page" : undefined}
        aria-label={label}
        data-tip={expanded ? undefined : label}
        data-tip-side="right"
        onClick={() => app.setTab(item.id)}
      >
        <Icon icon={item.icon} size={17} anim={item.anim} />
        <span className="nav-label">{label}</span>
        {item.badge && <Badge tone="solid" className="nav-badge">{item.badge}</Badge>}
      </button>
    );
  };
  return (
    <nav className={cx("nav", !expanded && "nav-collapsed")} aria-label={t("Main navigation")}>
      {NAV_GROUPS.map((group, index) => (
        <div className="nav-group" key={group.label ?? `group-${index}`}>
          {group.label && <div className="caption nav-group-label">{t(group.label)}</div>}
          {group.items.map(renderItem)}
        </div>
      ))}
      <div className="nav-footer">
        {renderItem({ id: "logs", label: "Logs", icon: Terminal, anim: "nudge" })}
        <div className="nav-status" role="status">
          <StatusDot tone={running ? "busy" : "live"} />
          <span className="nav-status-text">{running ? t("Running") : t("ENGINE ONLINE")}</span>
        </div>
      </div>
    </nav>
  );
}
