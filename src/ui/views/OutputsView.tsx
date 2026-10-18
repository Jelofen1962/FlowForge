import { Archive, Download, Eye, FileText, FolderOpen, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Badge, Button, EmptyState, Hint, IconButton, Icon, Note } from "../components";
import { Page, PageHeader } from "../layout/Page";

export function OutputsView({ app }: { app: AppController }) {
  const { t, outputArchives, outputPreview, workflowId, dateLocale, setLogs } = app;
  return (
    <Page label={t("Outputs")}>
      <PageHeader
        eyebrow={t("WORKFLOW ARTIFACTS")}
        title={t("Outputs")}
        description={t("Text, extracted data, screenshots, images and completed downloads are collected into a ZIP for this workflow.")}
        actions={<Button icon={RefreshCw} iconAnim="spin" onClick={() => app.setOutputRefreshToken(v => v + 1)}>{t("Refresh")}</Button>}
      />
      <div className="card card-pad">
        <div className="caption" style={{ marginBottom: 6 }}>{t("CURRENT WORKFLOW")}</div>
        <strong>{app.workflowName}</strong>
        <Hint>{t("Each successful or failed run attempts to create a separate ZIP archive in FlowForge's local application data folder.")}</Hint>
      </div>

      {outputArchives.length === 0 ? (
        <EmptyState icon={Archive} title={t("No output ZIPs yet.")}>{t("Run this workflow with a screenshot, extract, save-text, or download action to generate output files.")}</EmptyState>
      ) : (
        <div className="stack">
          {outputArchives.map(archive => (
            <article className="card card-pad stack" key={archive.name}>
              <div className="row-between">
                <div className="card-title"><Icon icon={Archive} size={18} /><span className="truncate">{archive.name}</span></div>
                <Badge>{(archive.size / 1024).toFixed(1)} KB</Badge>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{new Date(archive.modifiedAt).toLocaleString(dateLocale)} · {archive.artifacts.length} {t("artifacts")}</div>
              <div className="artifact-list">
                {archive.artifacts.map(artifact => (
                  <div className="artifact-row" key={artifact.name}>
                    <span><Icon icon={FileText} size={14} /><span className="truncate">{artifact.name}</span><small>{(artifact.size / 1024).toFixed(1)} KB</small></span>
                    <IconButton size="sm" icon={Eye} iconAnim="pop" label={t("Preview output")} onClick={async () => {
                      const r = await window.flowforge.readOutput(workflowId, archive.name, artifact.name);
                      if (!r.ok) { setLogs(old => [...old, r.error || "Preview failed"].slice(-300)); return; }
                      app.setOutputPreview({ archive: archive.name, name: artifact.name, mime: r.mime || "application/octet-stream", data: r.data || "", text: r.text });
                    }} />
                  </div>
                ))}
              </div>
              <div className="row">
                <Button variant="primary" icon={Download} iconAnim="drop" onClick={async () => { const r = await window.flowforge.openOutput(workflowId, archive.name); if (!r.ok) setLogs(old => [...old, r.error || "Could not open ZIP"].slice(-300)); }}>{t("Open ZIP")}</Button>
                <Button icon={FolderOpen} iconAnim="pop" onClick={() => void window.flowforge.revealOutput(workflowId, archive.name)}>{t("Show in folder")}</Button>
                <Button variant="danger" icon={Trash2} iconAnim="wiggle" onClick={async () => {
                  if (!confirm(`${t("Delete")} ${archive.name}?`)) return;
                  await window.flowforge.deleteOutput(workflowId, archive.name);
                  app.setOutputPreview(p => (p?.archive === archive.name ? null : p));
                  app.setOutputRefreshToken(v => v + 1);
                }}>{t("Delete")}</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {outputPreview && (
        <section className="card card-pad stack" aria-label={t("Preview output")}>
          <div className="row-between">
            <div className="card-title"><Icon icon={Eye} size={16} />{t("Preview")}: {outputPreview.name}</div>
            <IconButton size="sm" icon={X} iconAnim="rotate" label={t("Close preview")} tipSide="end" onClick={() => app.setOutputPreview(null)} />
          </div>
          {outputPreview.mime.startsWith("image/") ? <img className="preview-img" alt={outputPreview.name} src={`data:${outputPreview.mime};base64,${outputPreview.data}`} />
            : outputPreview.text !== undefined ? <pre className="preview-pre">{outputPreview.text}</pre>
            : <Hint>{t("This file type cannot be previewed in the app. Open the ZIP to inspect it.")}</Hint>}
        </section>
      )}
      <Note tone="warn" icon={TriangleAlert}>{t("Output archives may contain personal data, screenshots, or downloaded files. Review them before sharing. Preview is limited to 10 MB per file.")}</Note>
    </Page>
  );
}
