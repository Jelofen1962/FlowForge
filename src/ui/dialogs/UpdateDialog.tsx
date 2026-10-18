import { ExternalLink, RefreshCw } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Button, Dialog, Icon } from "../components";

export function UpdateDialog({ app }: { app: AppController }) {
  const { t, updateInfo, setUpdateInfo, appVersion } = app;
  if (!updateInfo) return null;
  const close = () => setUpdateInfo(null);
  return (
    <Dialog open onClose={close} labelledBy="update-title">
      <div className="dialog-head">
        <span className="dialog-icon"><Icon icon={RefreshCw} size={20} anim="spin" /></span>
        <div className="eyebrow">{t("A new version is available")}</div>
        <h2 id="update-title" style={{ fontSize: 20 }}>FlowForge {updateInfo.latestVersion ? `v${updateInfo.latestVersion}` : ""}</h2>
      </div>
      <div className="version-pair">
        <div><small>{t("Current version")}</small><strong>{updateInfo.currentVersion || appVersion}</strong></div>
        <div><small>{t("Latest version")}</small><strong>{updateInfo.latestVersion || "—"}</strong></div>
      </div>
      {updateInfo.notes && <div className="release-notes"><strong>{t("Release notes")}</strong><p>{updateInfo.notes}</p></div>}
      <div className="dialog-actions">
        <Button data-autofocus onClick={close}>{t("Later")}</Button>
        <Button variant="primary" icon={ExternalLink} iconAnim="nudge" onClick={() => { if (updateInfo.url) window.flowforge.openExternal(updateInfo.url); close(); }}>{t("View release")}</Button>
      </div>
    </Dialog>
  );
}
