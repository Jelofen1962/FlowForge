import { Archive, Copy, Download, FolderOpen, Plus, Trash2, Workflow } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Badge, Button, IconButton, Icon, Note, cx } from "../components";
import { Page, PageHeader } from "../layout/Page";
import { TriangleAlert } from "lucide-react";

export function LibraryView({ app }: { app: AppController }) {
  const { t, workflowLibrary, workflowId, dateLocale } = app;
  return (
    <Page label={t("Workflows")}>
      <PageHeader
        eyebrow={t("LOCAL WORKFLOW LIBRARY")}
        title={t("Workflows")}
        description={t("Create, edit, duplicate, import and share independent workflows. Changes save locally as you edit.")}
        actions={<>
          <Button icon={FolderOpen} iconAnim="pop" onClick={app.importWorkflow}>{t("Import JSON")}</Button>
          <Button variant="primary" icon={Plus} iconAnim="rotate" onClick={app.newWorkflow}>{t("New workflow")}</Button>
        </>}
      />
      <div className="grid-cards">
        {workflowLibrary.map(item => {
          const active = item.id === workflowId;
          return (
            <article key={item.id} className={cx("card tile card-interactive", active && "card-active")}>
              <div className="tile-top">
                <span className="tile-glyph"><Icon icon={Workflow} size={18} /></span>
                <span className="grow" />
                {item.aiTag && <Badge tone="solid">AI</Badge>}
                <Badge tone={active ? "primary" : "neutral"}>{active ? t("OPEN") : t("SAVED")}</Badge>
              </div>
              <h2>{item.document.name}</h2>
              <p className="truncate">{item.document.startUrl || t("No start URL configured")}</p>
              <div className="tile-meta">{item.document.steps.length} {t("steps")} · {item.document.browser} · {t("Updated")} {new Date(item.updatedAt).toLocaleDateString(dateLocale)}</div>
              <div className="tile-actions">
                <Button variant="primary" onClick={() => app.activateWorkflow(item)}>{active ? t("Continue editing") : t("Open & edit")}</Button>
                <IconButton variant="outline" icon={Copy} iconAnim="pop" label={t("Duplicate workflow")} onClick={() => app.duplicateWorkflow(item)} />
                <IconButton variant="outline" icon={Download} iconAnim="drop" label={t("Export workflow and referenced sub-workflows")} onClick={() => app.exportWorkflowFor(item)} />
                <IconButton variant="outline" icon={Archive} iconAnim="drop" label={t("View this workflow's output ZIPs")} onClick={() => { app.activateWorkflow(item); app.setTab("outputs"); }} />
                <IconButton variant="danger" icon={Trash2} iconAnim="wiggle" label={t("Delete workflow")} tipSide="end" disabled={workflowLibrary.length <= 1} onClick={() => app.deleteWorkflow(item.id)} />
              </div>
            </article>
          );
        })}
      </div>
      <Note tone="warn" icon={TriangleAlert}>{t("Workflow files may contain typed values and personal data. Review JSON before sharing. Imported workflow packages remap workflow IDs so their sub-workflow references stay connected.")}</Note>
    </Page>
  );
}
