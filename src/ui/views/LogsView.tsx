import { Eraser } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Button } from "../components";
import { Page, PageHeader } from "../layout/Page";
import { LogView } from "../editor/ConsoleDock";

export function LogsView({ app }: { app: AppController }) {
  const { t, logs } = app;
  return (
    <Page label={t("Engine logs")}>
      <PageHeader
        eyebrow={t("DIAGNOSTICS")}
        title={t("Engine logs")}
        description={t("Live output from the local Selenium runner.")}
        actions={<Button icon={Eraser} iconAnim="wiggle" disabled={!logs.length} onClick={() => app.setLogs([])}>{t("Clear logs")}</Button>}
      />
      <LogView className="console-large" lines={logs} empty={t("Engine output appears here when a workflow runs.")} />
    </Page>
  );
}
