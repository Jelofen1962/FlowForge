import { CircleCheck, CircleX, History, LoaderCircle, OctagonAlert, OctagonX, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppController, RunRecord } from "../state/useAppController";
import { Badge, Button, EmptyState, Note } from "../components";
import { Page, PageHeader } from "../layout/Page";

const STATUS: Record<RunRecord["status"], { icon: LucideIcon; tone: "primary" | "danger" | "solid" | "warning" | "neutral" }> = {
  success: { icon: CircleCheck, tone: "primary" },
  failed: { icon: CircleX, tone: "danger" },
  running: { icon: LoaderCircle, tone: "solid" },
  stopped: { icon: OctagonX, tone: "neutral" },
  interrupted: { icon: OctagonAlert, tone: "warning" },
};

export function HistoryView({ app }: { app: AppController }) {
  const { t, runHistory, dateLocale } = app;
  return (
    <Page label={t("Run history")}>
      <PageHeader
        eyebrow={t("EXECUTION DIAGNOSTICS")}
        title={t("Run history")}
        description={t("Recent automation outcomes are stored locally on this device.")}
        actions={<Button icon={Trash2} iconAnim="wiggle" disabled={!runHistory.length} onClick={() => { app.setRunHistory([]); app.activeRunId.current = null; }}>{t("Clear history")}</Button>}
      />
      {runHistory.length === 0 ? (
        <EmptyState icon={History} title={t("No runs yet")}>{t("No runs recorded yet. Run a workflow to start building history.")}</EmptyState>
      ) : (
        <div className="history-list">
          {runHistory.map(item => {
            const meta = STATUS[item.status];
            return (
              <article className="card history-card" key={item.id}>
                <div className="row-between">
                  <strong>{item.workflow}</strong>
                  <Badge tone={meta.tone} icon={meta.icon}>{t(item.status)}</Badge>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{t("Started")} {new Date(item.startedAt).toLocaleString(dateLocale)} · {item.durationMs === undefined ? t("In progress") : `${(item.durationMs / 1000).toFixed(1)}s`}</div>
                <div className="history-stats">
                  <Badge tone="primary">{item.successfulSteps} {t("succeeded")}</Badge>
                  <Badge tone={item.failedSteps ? "danger" : "neutral"}>{item.failedSteps} {t("failed")}</Badge>
                  <Badge>{item.skippedSteps} {t("skipped")}</Badge>
                  <Badge tone="outline">{item.totalSteps} {t("total")}</Badge>
                </div>
                {item.error && <Note tone="danger">{item.error}</Note>}
              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
