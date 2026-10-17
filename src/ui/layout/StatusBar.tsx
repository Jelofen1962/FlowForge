import { CircleCheck, Layers, Maximize2, Minimize2, PanelBottom, PanelLeft, PanelRight, TriangleAlert } from "lucide-react";
import type { AppController } from "../state/useAppController";
import type { PanelLayoutApi } from "../state/usePanelLayout";
import { IconButton, StatusDot } from "../components";

export function StatusBar({ app, panels }: { app: AppController; panels: PanelLayoutApi }) {
  const { t, running, validation, steps, appVersion, tab } = app;
  const { layout } = panels;
  const issues = validation.errors.length;

  return (
    <footer className="statusbar">
      <div className="status-group">
        <span className="status-item"><StatusDot tone={running ? "busy" : "live"} />{running ? t("Running") : t("Ready")}</span>
        <span className={`status-item ${validation.valid ? "" : "is-bad"}`}>
          {validation.valid ? <CircleCheck size={13} /> : <TriangleAlert size={13} />}
          {validation.valid ? t("Valid") : `${issues} ${t("issues")}`}
        </span>
        <span className="status-item"><Layers size={13} /><span className="count">{steps.length} {t("STEPS")}</span></span>
      </div>
      <div className="status-group">
        {tab === "workflow" && (
          <div className="status-toggles" role="group" aria-label={t("Panels")}>
            <IconButton size="sm" icon={PanelLeft} label={`${t("Steps")} (Ctrl+[)`} tipSide="top" className="rtl-flip" aria-pressed={layout.steps.open} onClick={() => panels.toggleOpen("steps")} />
            <IconButton size="sm" icon={PanelBottom} label={`${t("Console")} (Ctrl+J)`} tipSide="top" aria-pressed={layout.dock.open} onClick={() => panels.toggleOpen("dock")} />
            <IconButton size="sm" icon={PanelRight} label={`${t("Run status")} (Ctrl+])`} tipSide="top" className="rtl-flip" aria-pressed={layout.run.open} onClick={() => panels.toggleOpen("run")} />
            <IconButton size="sm" icon={panels.focusMode ? Minimize2 : Maximize2} label={`${t("Focus mode")} (Ctrl+\\)`} tipSide="top" aria-pressed={panels.focusMode} onClick={panels.toggleFocus} />
          </div>
        )}
        <span className="status-item">v{appVersion}</span>
      </div>
    </footer>
  );
}
