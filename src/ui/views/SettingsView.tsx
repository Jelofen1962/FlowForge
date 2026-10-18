import { Globe, RefreshCw, Send, SlidersHorizontal } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Button, Field, Icon, Select, SwitchRow, Segmented, Hint } from "../components";
import { Page, PageHeader } from "../layout/Page";
import { ScheduleSettings } from "../widgets/ScheduleSettings";

export function SettingsView({ app }: { app: AppController }) {
  const { t, appVersion, updateChecking, updateMessage } = app;
  return (
    <Page label={t("Settings")}>
      <PageHeader eyebrow={t("ENGINE CONFIGURATION")} title={t("Settings")} description={t("Control how the automation engine behaves.")} />
      <div className="settings-grid">
        <section className="card card-pad stack">
          <div className="card-title"><Icon icon={SlidersHorizontal} size={16} />{t("OPTIMIZATIONS")}</div>
          <div>
            <SwitchRow label={t("Disable images")} description={t("Lower bandwidth and speed up page loads.")} checked={app.disableImages} onChange={app.setDisableImages} />
            <SwitchRow label={t("Disable CSS")} description={t("Blocks stylesheet requests; may break page layouts.")} checked={app.disableCss} onChange={app.setDisableCss} />
            <SwitchRow label={t("Disable web fonts")} description={t("Block WOFF/TTF/OTF requests.")} checked={app.disableFonts} onChange={app.setDisableFonts} />
            <SwitchRow label={t("Disable audio/video")} description={t("Block common media file requests.")} checked={app.disableMedia} onChange={app.setDisableMedia} />
            <SwitchRow label={t("Headless browser")} description={t("Run Chrome/Edge without showing a browser window")} checked={app.headless} onChange={app.setHeadless} />
            <SwitchRow label={t("Close browser after run")} description={t("Close WebDriver session when the workflow finishes.")} checked={app.closeBrowser} onChange={app.setCloseBrowser} />
          </div>
          <Field label={t("Page load strategy")}>
            <Select value={app.pageLoadStrategy} onChange={event => app.setPageLoadStrategy(event.target.value)}>
              <option value="normal">{t("Normal · wait for load")}</option><option value="eager">{t("Eager · wait for DOM ready")}</option><option value="none">{t("None · return immediately")}</option>
            </Select>
          </Field>
          <Field as="div" label={t("Default browser")}>
            <Segmented block label={t("Default browser")} value={app.browser as "chrome" | "edge"} onChange={value => app.setBrowser(value)} options={[{ value: "chrome", label: "Chrome", icon: Globe }, { value: "edge", label: "Edge", icon: Globe }]} />
          </Field>
        </section>

        <div className="stack">
          <section className="card card-pad">
            <ScheduleSettings
              t={t}
              enabled={app.scheduleEnabled} setEnabled={app.setScheduleEnabled}
              every={app.scheduleEvery} setEvery={app.setScheduleEvery}
              unit={app.scheduleUnit} setUnit={app.setScheduleUnit}
              startup={app.scheduleStartup}
              onStartupChange={async enabled => {
                app.setScheduleStartup(enabled);
                const result = await window.flowforge.setLaunchAtLogin(enabled);
                if (!result.ok) app.setLogs(old => [...old, `Could not update Windows startup setting: ${result.error || "unknown error"}`]);
              }}
            />
          </section>

          <section className="card card-pad stack">
            <div className="caption">{t("About FlowForge")}</div>
            <div className="about-title"><h2 style={{ fontSize: 20 }}>FlowForge</h2><span className="mono muted">v{appVersion}</span></div>
            <Hint>{t("Maintainer")}: <strong>Amirreza Taati</strong> (Jelofen1962)</Hint>
            <div className="row">
              <Button icon={Globe} iconAnim="spin" onClick={() => window.flowforge.openExternal("https://github.com/Jelofen1962")}>GitHub · Jelofen1962</Button>
              <Button icon={Send} iconAnim="nudge" onClick={() => window.flowforge.openExternal("https://t.me/Jelofen1962")}>Telegram · Jelofen1962</Button>
            </div>
            <div className="update-row">
              <div><strong>{t("Check for updates")}</strong><small role="status">{updateMessage || t("Checks the latest stable release on GitHub.")}</small></div>
              <Button variant="primary" icon={RefreshCw} iconSpinning={updateChecking} iconAnim="spin" disabled={updateChecking} onClick={() => void app.checkForUpdates(true)}>
                {updateChecking ? t("Checking for updates…") : t("Check for updates")}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}
