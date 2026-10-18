import { AppWindow, Globe, LoaderCircle, Play, ShieldCheck, SlidersHorizontal, Square } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Badge, Button, Field, Hint, Icon, Input, ProgressBar, Section, Segmented, Select, SwitchRow } from "../components";

/** Right column: progress, run controls, and the environment the workflow runs in. */
export function RunPanelBody({ app }: { app: AppController }) {
  const { t, steps, runState, running, validation } = app;
  const done = Object.values(runState).filter(status => status === "success").length;
  const failed = Object.values(runState).filter(status => status === "error").length;
  const canRun = !running && validation.valid && steps.length > 0;

  return (
    <>
      <div className="run-hero">
        <div className="row-between">
          <Badge tone={running ? "solid" : "neutral"} icon={running ? LoaderCircle : undefined}>{running ? t("RUNNING") : t("IDLE")}</Badge>
          {failed > 0 && <Badge tone="danger">{failed} {t("failed")}</Badge>}
        </div>
        <div>
          <div className="run-count" aria-live="polite">{done}<small>/{steps.length}</small></div>
          <div className="muted" style={{ fontSize: 12 }}>{t("steps completed")}</div>
        </div>
        <ProgressBar value={steps.length ? done / steps.length : 0} label={t("Run progress")} />
        <div className="run-actions">
          <Button variant="primary" size="lg" className="btn-run" disabled={!canRun} onClick={() => void app.run()} icon={running ? LoaderCircle : Play} iconSpinning={running} iconAnim="nudge">
            {running ? t("Automation running") : t("Run automation")}
          </Button>
          <Button size="lg" variant="danger" icon={Square} disabled={!running} onClick={() => void window.flowforge.stop()} aria-label={t("Stop")} />
        </div>
      </div>

      <div className="run-body">
        <Section index="01" icon={AppWindow} title={t("BROWSER TARGET")}>
          <Segmented block label={t("Browser")} value={app.browser as "chrome" | "edge"} onChange={value => app.setBrowser(value)} options={[{ value: "chrome", label: "Chrome", icon: Globe }, { value: "edge", label: "Edge", icon: AppWindow }]} />
          <Field label={t("START URL")}><Input mono value={app.startUrl} onChange={event => app.setStartUrl(event.target.value)} placeholder="https://…" /></Field>
          <Field label={t("BROWSER PROFILE FOR THIS WORKFLOW")} hint={t("This profile is saved with this workflow and used whenever it runs. Create profiles in Profiles first.")}>
            <Select value={app.workflowProfileName} onChange={event => {
              app.setWorkflowProfileName(event.target.value);
              const profile = app.profiles.find(item => item.name === event.target.value);
              if (profile?.browser) app.setBrowser(profile.browser);
              if (profile?.name) void app.refreshSessions(profile.name);
            }}>
              <option value="">{t("Use default browser profile")}</option>
              {app.profiles.map(profile => <option key={profile.name} value={profile.name}>{profile.name}</option>)}
            </Select>
          </Field>
        </Section>

        <Section index="02" icon={SlidersHorizontal} title={t("OPTIMIZATIONS")} defaultOpen={false}>
          <div>
            <SwitchRow label={t("Disable images")} description={t("Reduce bandwidth and page load")} checked={app.disableImages} onChange={app.setDisableImages} />
            <SwitchRow label={t("Disable CSS")} description={t("Experimental, may break layouts")} checked={app.disableCss} onChange={app.setDisableCss} />
            <SwitchRow label={t("Disable fonts")} description={t("Block web font files")} checked={app.disableFonts} onChange={app.setDisableFonts} />
            <SwitchRow label={t("Disable media")} description={t("Block audio and video files")} checked={app.disableMedia} onChange={app.setDisableMedia} />
            <SwitchRow label={t("Headless browser")} description={t("Run Chrome/Edge without showing a browser window")} checked={app.headless} onChange={app.setHeadless} />
            <SwitchRow label={t("Close browser after run")} description={t("Keep open to inspect results")} checked={app.closeBrowser} onChange={app.setCloseBrowser} />
          </div>
          <Field label={t("Page load strategy")}>
            <Select aria-label={t("Page load strategy")} value={app.pageLoadStrategy} onChange={event => app.setPageLoadStrategy(event.target.value)}>
              <option value="normal">{t("Normal · wait for load")}</option>
              <option value="eager">{t("Eager · wait for DOM ready")}</option>
              <option value="none">{t("None · return immediately")}</option>
            </Select>
          </Field>
        </Section>

        <Hint icon={<Icon icon={ShieldCheck} size={13} />}>{t("Runs locally on your machine")}</Hint>
      </div>
    </>
  );
}

