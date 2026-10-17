import { Circle, Globe, Languages, LoaderCircle, Moon, PanelLeftClose, PanelLeftOpen, Play, Search, Square, Sun } from "lucide-react";
import type { AppController } from "../state/useAppController";
import type { PanelLayoutApi } from "../state/usePanelLayout";
import { Button, Icon, IconButton, Input, Kbd } from "../components";
import { BrandMark } from "./BrandMark";

export function Topbar({ app, panels, onOpenPalette }: { app: AppController; panels: PanelLayoutApi; onOpenPalette: () => void }) {
  const { t, running, recording, validation, steps, theme, language } = app;
  const saveKind = app.saveState === "Saving…" ? "saving" : app.saveState === "Local save failed" ? "error" : "saved";
  const canRun = !running && validation.valid && steps.length > 0;

  return (
    <header className="topbar">
      <div className="topbar-start">
        <IconButton icon={panels.layout.navExpanded ? PanelLeftClose : PanelLeftOpen} label={panels.layout.navExpanded ? t("Collapse navigation") : t("Expand navigation")} className="rtl-flip" iconAnim="nudge" onClick={panels.toggleNav} />
        <div className="brand">
          <BrandMark />
          <span className="brand-word">flowforge</span>
        </div>
        <span className="crumb-sep">/</span>
        <input className="title-input" value={app.workflowName} onChange={e => app.setWorkflowName(e.target.value)} aria-label={t("Workflow name")} spellCheck={false} />
        <span className="save-pill" data-state={saveKind}>
          <span className={`dot ${saveKind === "saving" ? "dot-busy" : saveKind === "error" ? "dot-danger" : "dot-live"}`} />
          {t(app.saveState)}
        </span>
      </div>

      <button type="button" className="palette-trigger" onClick={onOpenPalette} aria-label={t("Open command palette")}>
        <Icon icon={Search} size={15} anim="wiggle" />
        <span className="palette-label">{t("Search or run a command…")}</span>
        <span className="palette-keys"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
      </button>

      <div className="topbar-end">
        <div className="input-group url-field">
          <Icon icon={Globe} size={14} />
          <Input sm value={app.recordUrl} onChange={e => app.setRecordUrl(e.target.value)} placeholder="https://example.com" aria-label={t("Recorder start URL")} mono />
        </div>
        <Button variant="outline" size="sm" onClick={() => void app.startRecorder()} disabled={running} aria-pressed={recording} icon={Circle} iconAnim="pulse">
          <span>{recording ? t("Recording") : t("Record")}</span>
        </Button>
        {recording && <IconButton icon={Square} label={t("Stop recorder")} size="sm" variant="danger" onClick={() => void app.stopRecorder()} />}
        <Button variant="primary" size="sm" className="btn-run" onClick={() => void app.run()} disabled={!canRun} icon={running ? LoaderCircle : Play} iconSpinning={running} iconAnim="nudge">
          <span>{running ? t("Running") : t("Run workflow")}</span>
        </Button>
        <IconButton icon={Square} label={t("Stop")} size="sm" variant="danger" disabled={!running} onClick={() => void window.flowforge.stop()} iconAnim="pulse" />
        <span className="top-divider" />
        <Button variant="ghost" size="sm" className="lang-btn" icon={Languages} iconAnim="swing" onClick={() => app.setLanguage(v => v === "en" ? "fa" : "en")}>
          {language === "en" ? "FA" : "EN"}
        </Button>
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          iconAnim={theme === "dark" ? "spin" : "swing"}
          label={t(theme === "dark" ? "Switch to light theme" : "Switch to dark theme")}
          size="sm"
          onClick={() => app.setTheme(v => v === "dark" ? "light" : "dark")}
        />
      </div>
    </header>
  );
}
