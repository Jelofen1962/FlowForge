import { Check, Circle, Globe, Languages, LoaderCircle, Moon, PanelLeftClose, PanelLeftOpen, Play, Search, Square, Sun, TriangleAlert } from "lucide-react";
import type { AppController } from "../state/useAppController";
import type { PanelLayoutApi } from "../state/usePanelLayout";
import { Button, Icon, IconButton, Input, Kbd } from "../components";
import { BrandMark } from "./BrandMark";

type Props = { app: AppController; panels: PanelLayoutApi; onOpenPalette: () => void };

export function Topbar({ app, panels, onOpenPalette }: Props) {
  const { t, running, recording, validation, steps, theme, language } = app;
  const saveKind = app.saveState === "Saving…" ? "saving" : app.saveState === "Local save failed" ? "error" : "saved";
  const canRun = !running && validation.valid && steps.length > 0;
  const navLabel = panels.layout.navExpanded ? t("Collapse navigation") : t("Expand navigation");

  return (
    <header className="topbar">
      <div className="topbar-start">
        <IconButton icon={panels.layout.navExpanded ? PanelLeftClose : PanelLeftOpen} label={navLabel} className="rtl-flip" iconAnim="nudge" onClick={panels.toggleNav} aria-expanded={panels.layout.navExpanded} />
        <div className="brand">
          <BrandMark />
          <span className="brand-word">flowforge</span>
        </div>
        <span className="crumb-sep" aria-hidden="true">/</span>
        <input className="title-input" value={app.workflowName} onChange={event => app.setWorkflowName(event.target.value)} aria-label={t("Workflow name")} spellCheck={false} />
        <span className="save-pill" data-state={saveKind} role="status">
          <Icon icon={saveKind === "saving" ? LoaderCircle : saveKind === "error" ? TriangleAlert : Check} size={11} spinning={saveKind === "saving"} />
          {t(app.saveState)}
        </span>
      </div>

      <button type="button" className="palette-trigger" onClick={onOpenPalette} aria-label={t("Open command palette")} aria-haspopup="dialog" data-anim-host>
        <Icon icon={Search} size={15} anim="wiggle" />
        <span className="palette-label">{t("Search or run a command…")}</span>
        <span className="palette-keys"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
      </button>

      <div className="topbar-end">
        <div className="input-group url-field">
          <Icon icon={Globe} size={14} />
          <Input sm value={app.recordUrl} onChange={event => app.setRecordUrl(event.target.value)} placeholder="https://example.com" aria-label={t("Recorder start URL")} mono />
        </div>
        <Button variant="outline" onClick={() => void app.startRecorder()} disabled={running} aria-pressed={recording} icon={Circle} iconAnim="pulse">
          <span className="btn-label-collapse">{recording ? t("Recording") : t("Record")}</span>
        </Button>
        {recording && <IconButton icon={Square} label={t("Stop recorder")} variant="danger" onClick={() => void app.stopRecorder()} />}
        <Button variant="primary" className="btn-run" onClick={() => void app.run()} disabled={!canRun} icon={running ? LoaderCircle : Play} iconSpinning={running} iconAnim="nudge">
          <span className="btn-label-collapse">{running ? t("Running") : t("Run workflow")}</span>
        </Button>
        <IconButton icon={Square} label={t("Stop")} variant="danger" disabled={!running} onClick={() => void window.flowforge.stop()} iconAnim="pulse" />
        <span className="top-divider" aria-hidden="true" />
        <Button variant="ghost" size="sm" className="lang-btn" icon={Languages} iconAnim="swing" onClick={() => app.setLanguage(value => (value === "en" ? "fa" : "en"))} aria-label={t("Choose language")}>
          {language === "en" ? "FA" : "EN"}
        </Button>
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          iconAnim={theme === "dark" ? "spin" : "swing"}
          label={t(theme === "dark" ? "Switch to light theme" : "Switch to dark theme")}
          tipSide="end"
          onClick={() => app.setTheme(value => (value === "dark" ? "light" : "dark"))}
        />
      </div>
    </header>
  );
}

