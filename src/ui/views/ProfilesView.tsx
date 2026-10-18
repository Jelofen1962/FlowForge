import { FolderOpen, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Button, Field, Hint, Icon, Input, Note, Select } from "../components";
import { Page, PageHeader } from "../layout/Page";

export function ProfilesView({ app }: { app: AppController }) {
  const { t, running } = app;
  return (
    <Page label={t("Browser profiles")}>
      <PageHeader
        eyebrow={t("IDENTITY & STORAGE")}
        title={t("Browser profiles")}
        description={t("Keep browser identity separate between workflows.")}
        actions={<Button variant="primary" icon={Save} iconAnim="pop" onClick={() => void app.saveProfile()}>{t("Save profile")}</Button>}
      />
      <div className="settings-grid">
        <section className="card card-pad stack">
          <div className="card-title">{t("Profile name")}</div>
          <Field label={t("Profile name")}><Input value={app.profileName} onChange={event => app.setProfileName(event.target.value)} /></Field>
          <Field label={t("Browser")}>
            <Select value={app.browser} onChange={event => app.setBrowser(event.target.value)}>
              <option value="chrome">{t("Google Chrome")}</option><option value="edge">{t("Microsoft Edge")}</option>
            </Select>
          </Field>
          <Field label={t("Persistent user data directory (optional)")} hint={t("For persistent cookies and storage, use a dedicated automation profile directory. Do not point this at a browser profile that is currently open.")}>
            <Input mono value={app.userDataDir} onChange={event => app.setUserDataDir(event.target.value)} placeholder="C:\\FlowForge\\profiles\\work" />
          </Field>
          <div><Button variant="primary" icon={Save} iconAnim="pop" onClick={() => void app.saveProfile()}>{t("Save profile settings")}</Button></div>
        </section>

        <section className="card card-pad stack">
          <div className="card-title">{t("PORTABLE SESSION SNAPSHOT")}</div>
          <p className="card-desc">{t("Export or restore cookies and local/session storage for the current site origin. Start a browser session first. Import navigates to the snapshot origin before restoring state.")}</p>
          <div className="row">
            <Button variant="primary" icon={Save} iconAnim="pop" onClick={() => void app.exportSession()} disabled={!running}>{t("Export session JSON")}</Button>
            <Button icon={FolderOpen} iconAnim="pop" onClick={app.importSession} disabled={!running}>{t("Import session JSON")}</Button>
          </div>
          <Hint icon={<Icon icon={ShieldCheck} size={13} />}>{t("Session files contain authentication secrets. They are plain JSON, not encrypted. Store them securely and never commit them to source control. Only one origin is captured per snapshot.")}</Hint>
        </section>
      </div>
      <Note tone="warn" icon={TriangleAlert}>{t("Profile metadata and session snapshots are separate. The snapshot does not include passwords, browser cache, or other origins. Expired cookies are skipped; cookies outside the snapshot host scope are rejected.")}</Note>
    </Page>
  );
}
