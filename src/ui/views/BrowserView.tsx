import { Circle, Globe, MousePointerClick, ShieldCheck, Square, TriangleAlert } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Button, Icon, Input, Note } from "../components";
import { Page, PageHeader } from "../layout/Page";

export function BrowserView({ app }: { app: AppController }) {
  const { t, running, recording } = app;
  return (
    <Page label={t("Browser recorder")}>
      <PageHeader
        eyebrow={t("WORKFLOW RECORDING")}
        title={t("Browser recorder")}
        description={t("Enter a website in the URL field above and press Record. Use the site normally, then stop recording to edit the generated workflow.")}
      />
      <div className="card card-pad">
        <div className="rec-bar">
          <div className="input-group">
            <Icon icon={Globe} size={15} />
            <Input mono aria-label={t("Recorder start URL")} value={app.recordUrl} onChange={event => app.setRecordUrl(event.target.value)} placeholder="https://example.com" />
          </div>
          {recording
            ? <Button variant="danger" icon={Square} iconAnim="pulse" onClick={() => void app.stopRecorder()}>{t("Stop recorder")}</Button>
            : <Button variant="primary" icon={Circle} iconAnim="pulse" onClick={() => void app.startRecorder()} disabled={running}>{t("Start recording")}</Button>}
        </div>
      </div>
      <div className="card feature">
        <span className="feature-glyph"><Icon icon={MousePointerClick} size={22} anim="pulse" /></span>
        <div>
          <h2 style={{ fontSize: 16 }}>{t("Record real interactions")}</h2>
          <p className="card-desc" style={{ marginTop: 6 }}>{t("The recorder observes the real Chrome or Edge page without intercepting ordinary clicks. It captures element clicks, text entry, keyboard shortcuts, dropdown changes, right and double clicks, hover, scrolling, supported drag and drop, and page navigation. Every captured action becomes an editable workflow step.")}</p>
          <div className="mini-grid">
            <div className="mini"><Icon icon={MousePointerClick} size={17} anim="pop" /><strong>{t("Interactions")}</strong><p>{t("Clicks, typing, keys, select controls, hover and drag/drop")}</p></div>
            <div className="mini"><Icon icon={Globe} size={17} anim="pop" /><strong>{t("Navigation")}</strong><p>{t("URL changes are added to the recorded sequence")}</p></div>
            <div className="mini"><Icon icon={ShieldCheck} size={17} anim="pop" /><strong>{t("Privacy guard")}</strong><p>{t("Password and likely payment fields are not recorded")}</p></div>
          </div>
          <Note tone="warn" icon={TriangleAlert}>{t("Limits: browser chrome, native file-picker dialogs, CAPTCHA, canvas drawing, and some cross-origin iframe or custom-widget actions cannot be reliably captured. Review recorded steps before replaying them.")}</Note>
        </div>
      </div>
    </Page>
  );
}
