import { Activity, ListTree, Terminal } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { LIMITS, type PanelLayoutApi } from "../state/usePanelLayout";
import { Badge, ResizeHandle } from "../components";
import { Panel } from "../layout/Panel";
import { Inspector } from "./Inspector";
import { StepsPanelBody } from "./StepsPanel";
import { RunPanelBody } from "./RunPanel";
import { ConsoleActions, LogView } from "./ConsoleDock";

/**
 * The workspace: steps | inspector | run status, with a console dock underneath.
 * Every panel can be dragged to resize, collapsed to a rail/header, or hidden (Ctrl+[ · Ctrl+] · Ctrl+J · Ctrl+\).
 */
export function EditorView({ app, panels }: { app: AppController; panels: PanelLayoutApi }) {
  const { t, language, running } = app;
  const { layout } = panels;
  const rtl = language === "fa";
  const dockMax = Math.max(LIMITS.dock.min, Math.min(LIMITS.dock.max, Math.round(window.innerHeight * 0.6)));
  const labelsFor = (name: string) => ({ collapse: `${t("Collapse")} ${name}`, expand: `${t("Expand")} ${name}`, hide: `${t("Hide")} ${name}` });
  const stepsLabel = t("Steps");
  const runLabel = t("Run status");
  const consoleLabel = t("Console");

  return (
    <div className="editor" id="main" tabIndex={-1} role="main" aria-label={t("Editor")}>
      <div className="editor-main">
        {layout.steps.open && (
          <>
            <Panel
              title={stepsLabel}
              icon={ListTree}
              side="start"
              className="panel-steps"
              collapsed={layout.steps.collapsed}
              onToggleCollapsed={() => panels.toggleCollapsed("steps")}
              onHide={() => panels.hide("steps")}
              labels={labelsFor(stepsLabel)}
              badge={<Badge>{app.steps.length}</Badge>}
              style={layout.steps.collapsed ? undefined : { width: layout.steps.size, minWidth: LIMITS.steps.min, flex: "none" }}
            >
              <StepsPanelBody app={app} />
            </Panel>
            {!layout.steps.collapsed && (
              <ResizeHandle label={t("Resize workflow steps panel")} value={layout.steps.size} min={LIMITS.steps.min} max={LIMITS.steps.max} invert={rtl} onChange={size => panels.setSize("steps", size)} onReset={() => panels.resetSize("steps")} />
            )}
          </>
        )}

        <section className="editor-center" aria-label={t("STEP CONFIGURATION")}>
          <Inspector app={app} />
        </section>

        {layout.run.open && (
          <>
            {!layout.run.collapsed && (
              <ResizeHandle label={t("Resize run status panel")} value={layout.run.size} min={LIMITS.run.min} max={LIMITS.run.max} invert={!rtl} onChange={size => panels.setSize("run", size)} onReset={() => panels.resetSize("run")} />
            )}
            <Panel
              title={runLabel}
              icon={Activity}
              side="end"
              className="panel-run"
              collapsed={layout.run.collapsed}
              onToggleCollapsed={() => panels.toggleCollapsed("run")}
              onHide={() => panels.hide("run")}
              labels={labelsFor(runLabel)}
              style={layout.run.collapsed ? undefined : { width: layout.run.size, minWidth: LIMITS.run.min, flex: "none" }}
            >
              <RunPanelBody app={app} />
            </Panel>
          </>
        )}
      </div>

      {layout.dock.open && (
        <>
          {!layout.dock.collapsed && (
            <ResizeHandle orientation="horizontal" label={t("Resize console")} value={layout.dock.size} min={LIMITS.dock.min} max={dockMax} onChange={size => panels.setSize("dock", size)} onReset={() => panels.resetSize("dock")} />
          )}
          <Panel
            title={consoleLabel}
            icon={Terminal}
            side="bottom"
            className="panel-dock"
            collapsed={layout.dock.collapsed}
            onToggleCollapsed={() => panels.toggleCollapsed("dock")}
            onHide={() => panels.hide("dock")}
            labels={labelsFor(consoleLabel)}
            badge={<Badge tone={running ? "solid" : "neutral"}>{app.logs.length}</Badge>}
            actions={<ConsoleActions app={app} />}
            style={layout.dock.collapsed ? { flex: "none" } : { height: layout.dock.size, flex: "none" }}
          >
            <LogView lines={app.logs} empty={t("Engine output appears here when a workflow runs.")} />
          </Panel>
        </>
      )}
    </div>
  );
}
