import { Archive, Fingerprint, History, LayoutTemplate, LibraryBig, MousePointerClick, Settings, Sparkles, Terminal, Variable, Workflow } from "lucide-react";
import type { AppController } from "../state/useAppController";
import type { PanelLayoutApi } from "../state/usePanelLayout";
import { Badge, Icon, StatusDot, cx } from "../components";

export function NavSidebar({ app, panels }: { app: AppController; panels: PanelLayoutApi }) {
  const { t, tab, running } = app;
  const exp = panels.layout.navExpanded;

  const items = [
    { id: "workflow", label: "Editor", icon: Workflow, anim: "nudge" as const },
    { id: "variables", label: "Variables", icon: Variable, anim: "pop" as const },
    { id: "library", label: "Workflows", icon: LibraryBig, anim: "bounce" as const },
    { id: "templates", label: "Templates", icon: LayoutTemplate, anim: "pop" as const },
    { id: "browser", label: "Browser", icon: MousePointerClick, anim: "pulse" as const },
    { id: "outputs", label: "Outputs", icon: Archive, anim: "drop" as const },
    { id: "history", label: "Run history", icon: History, anim: "turn" as const },
    { id: "profiles", label: "Profiles", icon: Fingerprint, anim: "pop" as const },
    { id: "settings", label: "Settings", icon: Settings, anim: "turn" as const },
    { id: "ai", label: "AI Studio", icon: Sparkles, anim: "pulse" as const, badge: "AI" },
  ];

  return (
    <nav className={cx("nav", !exp && "nav-collapsed")} aria-label={t("Main navigation")}>
      <div className="nav-group">
        {items.map(item => {
          const label = t(item.label);
          return (
            <button
              key={item.id}
              type="button"
              className="nav-item"
              aria-current={tab === item.id ? "page" : undefined}
              data-tip={exp ? undefined : label}
              data-tip-side="right"
              onClick={() => app.setTab(item.id)}
            >
              <Icon icon={item.icon} size={17} anim={item.anim} />
              <span className="nav-label">{label}</span>
              {item.badge && <Badge tone="solid" className="nav-badge">{item.badge}</Badge>}
            </button>
          );
        })}
      </div>
      <div className="nav-footer">
        <button type="button" className="nav-item" aria-current={tab === "logs" ? "page" : undefined} onClick={() => app.setTab("logs")}>
          <Icon icon={Terminal} size={17} anim="nudge" />
          <span className="nav-label">{t("Logs")}</span>
        </button>
        <div className="nav-status">
          <StatusDot tone={running ? "busy" : "live"} />
          <span className="nav-status-text">{running ? t("Running") : t("ENGINE ONLINE")}</span>
        </div>
      </div>
    </nav>
  );
}
