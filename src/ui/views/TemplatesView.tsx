import { FileText, Search, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Badge, Button, Icon, Note } from "../components";
import { Page, PageHeader } from "../layout/Page";

const TEMPLATES: Array<{ kind: "starter" | "form" | "search"; icon: LucideIcon; eyebrow: string; title: string; text: string; meta: string }> = [
  { kind: "starter", icon: ShieldCheck, eyebrow: "BASIC VALIDATION", title: "Website smoke check", text: "Open a page, wait for its main heading, and assert expected text. Uses example.com as a safe placeholder.", meta: "3 steps · Navigate · Wait · Assert" },
  { kind: "form", icon: FileText, eyebrow: "FORM AUTOMATION", title: "Form entry starter", text: "Demonstrates waiting for an email field, typing a value, and submitting a form. Update selectors before use.", meta: "4 steps · Navigate · Wait · Type · Click" },
  { kind: "search", icon: Search, eyebrow: "SEARCH AUTOMATION", title: "Search page starter", text: "Demonstrates locating a search box, entering a query, and pressing Enter. Replace the example selectors.", meta: "4 steps · Navigate · Wait · Type · Key" },
];

export function TemplatesView({ app }: { app: AppController }) {
  const { t } = app;
  return (
    <Page label={t("Templates")}>
      <PageHeader eyebrow={t("WORKFLOW LIBRARY")} title={t("Templates")} description={t("Start from a practical pattern, then replace sample URLs and selectors with your own target.")} />
      <div className="grid-cards">
        {TEMPLATES.map(item => (
          <article key={item.kind} className="card tile card-interactive">
            <div className="tile-top"><span className="tile-glyph"><Icon icon={item.icon} size={18} /></span><span className="grow" /><Badge>{t(item.eyebrow)}</Badge></div>
            <h2>{t(item.title)}</h2>
            <p>{t(item.text)}</p>
            <div className="tile-meta">{item.meta}</div>
            <div className="tile-actions"><Button variant="primary" onClick={() => app.applyTemplate(item.kind)}>{t("Use template")}</Button></div>
          </article>
        ))}
      </div>
      <Note tone="warn" icon={TriangleAlert}>{t("Templates are starter examples, not site-specific automations. They may fail until you configure selectors for the website you are authorized to automate.")}</Note>
    </Page>
  );
}
