import { useEffect } from "react";
import { useAppController } from "./state/useAppController";
import { usePanelLayout } from "./state/usePanelLayout";
import { Topbar } from "./layout/Topbar";
import { NavSidebar } from "./layout/NavSidebar";
import { StatusBar } from "./layout/StatusBar";
import { Page, PageHeader } from "./layout/Page";
import { Panel } from "./layout/Panel";
import { ResizeHandle } from "./components/ResizeHandle";
import { ActionPicker } from "./components/ActionPicker";
import { Button, IconButton } from "./components/Button";
import { Input, Textarea, Select, Field, SwitchRow, CheckRow } from "./components/Fields";
import { Badge, Note, EmptyState, ProgressBar } from "./components/Misc";
import { Section } from "./components/Section";
import { Dialog } from "./components/Dialog";
import {
  Activity, AppWindow, ArrowDown, ArrowUp, Braces, Check, Copy, FileText,
  FolderOpen, Globe, Layers, MousePointer2, Plus, RefreshCw, Save, Search,
  Terminal, Trash2, Eye, Download, Code2, ShieldCheck, Sparkles, Network, ExternalLink
} from "lucide-react";
import { stepTypes, actionIcons } from "./data/actionCatalog";
import type { StepType, LocatorStrategy, OnErrorPolicy, WorkflowStep } from "../core/workflow";

export default function App() {
  const app = useAppController();
  const panels = usePanelLayout();
  const { t } = app;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); app.setCommandOpen(v => !v); app.setCommandQuery("");
      } else if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault(); panels.toggleOpen("steps");
      } else if ((e.ctrlKey || e.metaKey) && e.key === "]") {
        e.preventDefault(); panels.toggleOpen("run");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault(); panels.toggleOpen("dock");
      } else if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault(); panels.toggleFocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app, panels]);

  const commandItems = [
    { label: "Run workflow", detail: "Execute current workflow", run: () => { app.setCommandOpen(false); void app.run(); } },
    { label: "Stop execution", detail: "Request browser run to halt", run: () => { app.setCommandOpen(false); void window.flowforge.stop(); } },
    { label: "New workflow", detail: "Start a fresh blank workflow", run: app.newWorkflow },
    { label: "Add click step", detail: "Insert a mouse click action", run: () => { app.addStep("click"); app.setCommandOpen(false); } },
    { label: "Add type step", detail: "Insert a keyboard text action", run: () => { app.addStep("type"); app.setCommandOpen(false); } },
    { label: "Add user input step", detail: "Prompt user for interactive inputs", run: () => { app.addStep("userInput"); app.setCommandOpen(false); } },
    { label: "Import workflow", detail: "Load JSON package from disk", run: () => { app.setCommandOpen(false); app.importWorkflow(); } },
    { label: "Export workflow", detail: "Save workflow and subflows to JSON", run: () => { app.setCommandOpen(false); app.exportWorkflow(); } },
    { label: "Open Editor", detail: "Switch to workflow step builder", run: () => { app.setTab("workflow"); app.setCommandOpen(false); } },
    { label: "Open Variables", detail: "Manage workflow & run data", run: () => { app.setTab("variables"); app.setCommandOpen(false); } },
    { label: "Open Library", detail: "Manage saved workflows", run: () => { app.setTab("library"); app.setCommandOpen(false); } },
    { label: "Open Outputs", detail: "Review extracted data and ZIPs", run: () => { app.setTab("outputs"); app.setCommandOpen(false); } },
    { label: "Open AI Studio", detail: "AI provider and tool agent", run: () => { app.setTab("ai"); app.setCommandOpen(false); } },
    { label: "Open Settings", detail: "Browser and startup options", run: () => { app.setTab("settings"); app.setCommandOpen(false); } },
  ];
  const filteredCommands = commandItems.filter(i => `${t(i.label)} ${t(i.detail)}`.toLowerCase().includes(app.commandQuery.toLowerCase()));

  const renderNestedSteps = (field: "thenSteps" | "elseSteps" | "loopSteps", label: string) => {
    const list = (app.current?.[field] || []) as WorkflowStep[];
    return (
      <div className="nested-builder">
        <div className="nested-builder-head">
          <div>
            <strong>{label}</strong>
            <span>{list.length} {list.length === 1 ? t("step") : t("steps")}</span>
          </div>
          <Button size="sm" variant="secondary" icon={Plus} iconAnim="pop" onClick={() => app.addNested(field, "click")}>{t("Add")}</Button>
        </div>
        {list.length === 0 ? (
          <div className="nested-empty">
            <Braces size={16} />
            <span>{t("No actions in this branch yet.")}</span>
            <small>{t("Add an action to define what happens here.")}</small>
          </div>
        ) : (
          <div className="nested-step-list">
            {list.map((child, index) => (
              <div className="nested-step-card" key={child.id}>
                <div className="nested-step-number">{index + 1}</div>
                <div className="nested-step-fields">
                  <ActionPicker
                    compact
                    label="Nested Action"
                    value={child.type}
                    t={t}
                    onChange={nt => {
                      const fresh = app.makeStep(nt);
                      app.patchNested(field, child.id, { ...fresh, id: child.id, name: stepTypes.find(i => i[0] === nt)?.[1] || nt });
                    }}
                  />
                  <Input sm value={child.name} onChange={e => app.patchNested(field, child.id, { name: e.target.value })} placeholder="Action name" />
                  {["navigate", "openTab"].includes(child.type) && <Input sm value={child.url || ""} onChange={e => app.patchNested(field, child.id, { url: e.target.value })} placeholder="https://..." />}
                  {["click", "type", "key", "hover", "rightClick", "doubleClick", "waitVisible", "waitClickable", "assertText"].includes(child.type) && child.target && (
                    <div className="nested-locator-row">
                      <Select sm value={child.target.strategy} onChange={e => app.patchNested(field, child.id, { target: { ...child.target!, strategy: e.target.value as LocatorStrategy } })}>
                        {["css", "xpath", "id", "name"].map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                      <Input sm mono value={child.target.value} onChange={e => app.patchNested(field, child.id, { target: { ...child.target!, value: e.target.value } })} placeholder="Selector..." />
                    </div>
                  )}
                  {["type", "key", "saveText"].includes(child.type) && <Input sm value={child.text || ""} onChange={e => app.patchNested(field, child.id, { text: e.target.value })} placeholder="Value..." />}
                </div>
                <IconButton icon={Trash2} label="Remove step" size="sm" variant="danger" onClick={() => app.removeNested(field, child.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      <Topbar app={app} panels={panels} onOpenPalette={() => app.setCommandOpen(true)} />

      <div className="app-body">
        <NavSidebar app={app} panels={panels} />

        {app.tab === "workflow" && (
          <div className="view row" style={{ gap: 0 }}>
            {panels.layout.steps.open && (
              <>
                <Panel
                  title={t("Steps")}
                  icon={Layers}
                  side="start"
                  collapsed={panels.layout.steps.collapsed}
                  onToggleCollapsed={() => panels.toggleCollapsed("steps")}
                  onHide={() => panels.hide("steps")}
                  labels={{ collapse: t("Collapse"), expand: t("Expand"), hide: t("Close") }}
                  style={{ width: panels.layout.steps.size }}
                  badge={<Badge tone="primary">{app.steps.length}</Badge>}
                  actions={<IconButton icon={Plus} label={t("Add step")} size="sm" onClick={() => app.addStep("click")} />}
                >
                  <div className="stack" style={{ padding: "0.8rem", gap: "0.6rem" }}>
                    <div className="input-group">
                      <Icon icon={Search} size={14} />
                      <Input sm placeholder={t("Find a step…")} value={app.stepSearch} onChange={e => app.setStepSearch(e.target.value)} />
                    </div>
                    <div className="step-list">
                      {app.steps
                        .filter(s => `${s.name} ${s.type} ${s.target?.value || ""}`.toLowerCase().includes(app.stepSearch.toLowerCase()))
                        .map((step, i) => (
                          <div
                            key={step.id}
                            className={`step-card ${step.id === app.selected ? "selected" : ""}`}
                            onClick={() => app.setSelected(step.id)}
                          >
                            <div className="step-index">
                              {app.runState[step.id] === "success" ? <Check size={14} /> : String(i + 1).padStart(2, "0")}
                            </div>
                            <div className="grow truncate">
                              <div className="step-name truncate">{step.name}</div>
                              <div className="step-sub truncate">{step.type} {step.target?.value ? `· ${step.target.value}` : ""}</div>
                            </div>
                            <IconButton icon={Trash2} label={t("Delete step")} size="sm" variant="danger" onClick={e => { e.stopPropagation(); app.deleteStep(step.id); }} />
                          </div>
                        ))}
                    </div>
                    <Button variant="dashed" block icon={Plus} iconAnim="pop" onClick={() => app.addStep("click")}>{t("Add step")}</Button>
                    <Button variant="outline" block icon={Braces} onClick={() => app.addStep("userInput")}>{t("Add user input step")}</Button>
                  </div>
                </Panel>
                {!panels.layout.steps.collapsed && (
                  <ResizeHandle
                    orientation="vertical"
                    label={t("Resize steps panel")}
                    value={panels.layout.steps.size}
                    min={240}
                    max={520}
                    onChange={v => panels.setSize("steps", v)}
                    onReset={() => panels.resetSize("steps")}
                  />
                )}
              </>
            )}

            <main className="view" style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              <div style={{ padding: "1.2rem 1.8rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>
                <header className="page-head" style={{ marginBottom: "1.2rem" }}>
                  <div className="page-head-copy">
                    <div className="eyebrow">{t("STEP CONFIGURATION")}</div>
                    <h1>{app.current?.name || t("No step selected")}</h1>
                  </div>
                  <div className="page-head-actions">
                    <IconButton icon={ArrowUp} label="Move Up" size="sm" onClick={() => app.move(-1)} />
                    <IconButton icon={ArrowDown} label="Move Down" size="sm" onClick={() => app.move(1)} />
                    <IconButton icon={Copy} label="Duplicate Step" size="sm" onClick={app.duplicateStep} />
                  </div>
                </header>

                {app.current ? (
                  <div className="stack" style={{ gap: "1rem" }}>
                    <Field label={t("Step name")}>
                      <Input value={app.current.name} onChange={e => app.update({ name: e.target.value })} />
                    </Field>

                    <Field label={t("Action type")}>
                      <ActionPicker
                        label={t("Action type")}
                        value={app.current.type}
                        t={t}
                        onChange={type => {
                          const fresh = app.makeStep(type);
                          app.update({ ...fresh, id: app.current.id, name: t(stepTypes.find(t => t[0] === type)?.[1] || type) });
                        }}
                      />
                    </Field>

                    {["navigate", "openTab"].includes(app.current.type) && (
                      <Field label={t("URL")}>
                        <Input mono value={app.current.url || ""} onChange={e => app.update({ url: e.target.value })} placeholder="https://example.com" />
                      </Field>
                    )}

                    {["click", "type", "hover", "rightClick", "doubleClick", "waitVisible", "waitClickable", "assertText", "select", "uploadFile", "extractText", "extractAttribute", "extractValue"].includes(app.current.type) && (
                      <Field label={t("Target locator")}>
                        <div className="locator-row">
                          <Select value={app.current.target?.strategy || "css"} onChange={e => app.update({ target: { ...app.current.target, strategy: e.target.value as LocatorStrategy } })}>
                            {["css", "xpath", "id", "name"].map(s => <option key={s} value={s}>{s}</option>)}
                          </Select>
                          <Input mono value={app.current.target?.value || ""} onChange={e => app.update({ target: { ...app.current.target, value: e.target.value } })} placeholder="button#submit or //button" />
                        </div>
                      </Field>
                    )}

                    {app.current.type === "type" && (
                      <Field label={t("Text to type")}>
                        <Textarea value={app.current.text || ""} onChange={e => app.update({ text: e.target.value })} />
                        <CheckRow label={t("Clear field before typing")} checked={app.current.clearFirst !== false} onChange={v => app.update({ clearFirst: v })} />
                      </Field>
                    )}

                    {app.current.type === "wait" && (
                      <Field label={t("Duration (milliseconds)")}>
                        <Input type="number" value={app.current.ms ?? 1000} onChange={e => app.update({ ms: Number(e.target.value) || 0 })} />
                      </Field>
                    )}

                    {app.current.type === "assertText" && (
                      <Field label={t("Expected text includes")}>
                        <Input value={app.current.expected || ""} onChange={e => app.update({ expected: e.target.value })} />
                      </Field>
                    )}

                    {app.current.type === "ifElse" && (
                      <Section title="Logic & Branching" icon={Braces}>
                        <div className="form-grid cols-2">
                          <Field label={t("Value to check")}>
                            <Select value={app.current.condition?.source || "lastText"} onChange={e => app.update({ condition: { ...(app.current.condition || { operator: "contains" }), source: e.target.value as any } })}>
                              <option value="lastText">{t("Last extracted text")}</option>
                              <option value="variable">{t("Workflow variable")}</option>
                              <option value="url">{t("Current URL")}</option>
                              <option value="urlChanged">{t("Did the URL change?")}</option>
                            </Select>
                          </Field>
                          <Field label={t("Operator")}>
                            <Select value={app.current.condition?.operator || "contains"} onChange={e => app.update({ condition: { ...(app.current.condition || { source: "lastText" }), operator: e.target.value as any } })}>
                              <option value="equals">equals</option>
                              <option value="contains">contains</option>
                              <option value="matches">regex matches</option>
                              <option value="truthy">truthy</option>
                            </Select>
                          </Field>
                        </div>
                        <Field label={t("Expected value")}>
                          <Input value={app.current.condition?.expected || ""} onChange={e => app.update({ condition: { ...(app.current.condition || { source: "lastText", operator: "contains" }), expected: e.target.value } })} />
                        </Field>
                        <div className="form-grid cols-2" style={{ marginTop: "0.5rem" }}>
                          {renderNestedSteps("thenSteps", t("If condition is true"))}
                          {renderNestedSteps("elseSteps", t("Otherwise"))}
                        </div>
                      </Section>
                    )}

                    {["repeat", "while", "loopList"].includes(app.current.type) && (
                      <Section title="Loop Iteration" icon={RefreshCw}>
                        {app.current.type === "repeat" && (
                          <Field label={t("Number of iterations (1 to 1,000)")}>
                            <Input type="number" min={1} max={1000} value={app.current.repeatCount ?? 2} onChange={e => app.update({ repeatCount: Number(e.target.value) || 2 })} />
                          </Field>
                        )}
                        {renderNestedSteps("loopSteps", t("Loop body"))}
                      </Section>
                    )}

                    <Section title={t("Error handling")} defaultOpen={false}>
                      <div className="form-grid cols-2">
                        <Field label={t("On error")}>
                          <Select value={app.current.onError || "stop"} onChange={e => app.update({ onError: e.target.value as OnErrorPolicy })}>
                            <option value="stop">{t("Stop workflow")}</option>
                            <option value="continue">{t("Continue to next step")}</option>
                          </Select>
                        </Field>
                        <Field label={t("Timeout (ms)")}>
                          <Input type="number" value={app.current.timeout || 10000} onChange={e => app.update({ timeout: Number(e.target.value) })} />
                        </Field>
                      </div>
                    </Section>
                  </div>
                ) : (
                  <EmptyState icon={Layers} title={t("No step selected")}>
                    {t("Add a step to begin building your workflow.")}
                  </EmptyState>
                )}
              </div>
            </main>

            {panels.layout.run.open && (
              <>
                {!panels.layout.run.collapsed && (
                  <ResizeHandle
                    orientation="vertical"
                    label={t("Resize run status panel")}
                    value={panels.layout.run.size}
                    min={280}
                    max={520}
                    invert
                    onChange={v => panels.setSize("run", v)}
                    onReset={() => panels.resetSize("run")}
                  />
                )}
                <Panel
                  title={t("Run status")}
                  icon={Activity}
                  side="end"
                  collapsed={panels.layout.run.collapsed}
                  onToggleCollapsed={() => panels.toggleCollapsed("run")}
                  onHide={() => panels.hide("run")}
                  labels={{ collapse: t("Collapse"), expand: t("Expand"), hide: t("Close") }}
                  style={{ width: panels.layout.run.size }}
                >
                  <div className="stack" style={{ padding: "0.9rem", gap: "1rem" }}>
                    <div className="card card-pad">
                      <div className="card-head">
                        <span className="caption">{t("EXECUTION PROGRESS")}</span>
                        <Badge tone={app.running ? "primary" : "neutral"}>{app.running ? "RUNNING" : "IDLE"}</Badge>
                      </div>
                      <div className="summary-number">
                        {Object.values(app.runState).filter(s => s === "success").length}
                        <span>/{app.steps.length}</span>
                      </div>
                      <ProgressBar
                        label="Steps completed"
                        value={app.steps.length ? Object.values(app.runState).filter(s => s === "success").length / app.steps.length : 0}
                      />
                    </div>

                    <Section title={t("BROWSER TARGET")} defaultOpen>
                      <Field label={t("Browser")}>
                        <Select value={app.browser} onChange={e => app.setBrowser(e.target.value)}>
                          <option value="chrome">{t("Google Chrome")}</option>
                          <option value="edge">{t("Microsoft Edge")}</option>
                        </Select>
                      </Field>
                      <Field label={t("Start URL")}>
                        <Input mono value={app.startUrl} onChange={e => app.setStartUrl(e.target.value)} />
                      </Field>
                    </Section>

                    <Section title={t("OPTIMIZATIONS")} defaultOpen={false}>
                      <SwitchRow label={t("Headless browser")} checked={app.headless} onChange={app.setHeadless} />
                      <SwitchRow label={t("Disable images")} checked={app.disableImages} onChange={app.setDisableImages} />
                      <SwitchRow label={t("Disable CSS")} checked={app.disableCss} onChange={app.setDisableCss} />
                      <SwitchRow label={t("Close browser after run")} checked={app.closeBrowser} onChange={app.setCloseBrowser} />
                    </Section>

                    <div className="card card-pad stack">
                      <div className="row-between">
                        <span className="caption"><Terminal size={12} /> {t("ENGINE LOGS")}</span>
                        <Button size="sm" variant="ghost" onClick={() => app.setLogs([])}>{t("Clear")}</Button>
                      </div>
                      <div className="console" style={{ maxHeight: 180 }}>
                        {app.logs.slice(-12).map((l, i) => (
                          <div className="log-line" key={i}>
                            <span>{String(i + 1).padStart(2, "0")}</span>
                            <code>{l}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Panel>
              </>
            )}
          </div>
        )}

        {app.tab === "variables" && (
          <Page label={t("Variables")}>
            <PageHeader
              eyebrow={t("WORKFLOW DATA CENTER")}
              title={t("Variables")}
              description={`${t("Manage every value used by this workflow")} · ${app.workflowName}`}
              actions={<Button variant="primary" icon={Plus} iconAnim="pop" onClick={app.addVariable}>{t("Add variable")}</Button>}
            />
            <div className="variable-manager-layout">
              <div className="card variable-list-card">
                <div className="variable-list-heading">
                  <strong>{t("Variables")}</strong>
                  <Badge>{app.variables.length}</Badge>
                </div>
                {app.variables.map(v => (
                  <button
                    key={v.id}
                    className={`variable-list-item ${app.selectedVariableId === v.id ? "selected" : ""}`}
                    onClick={() => app.setSelectedVariableId(v.id)}
                  >
                    <span className="variable-list-icon"><Braces size={14} /></span>
                    <span className="variable-list-copy">
                      <strong>{v.name}</strong>
                      <small>{v.valueType || "text"} · {v.scope || "workflow"}</small>
                    </span>
                  </button>
                ))}
              </div>

              {app.variables.find(v => v.id === app.selectedVariableId) ? (
                (() => {
                  const active = app.variables.find(v => v.id === app.selectedVariableId)!;
                  return (
                    <div className="card card-pad stack">
                      <div className="row-between">
                        <div>
                          <h2>{active.name}</h2>
                          <p className="muted">Reference: <code>${`{${active.name}}`}</code></p>
                        </div>
                        <IconButton icon={Trash2} label={t("Delete variable")} variant="danger" onClick={() => app.setVariables(vs => vs.filter(x => x.id !== active.id))} />
                      </div>
                      <Field label={t("Variable name")}>
                        <Input value={active.name} onChange={e => app.updateVariable(active.id, { name: e.target.value })} />
                      </Field>
                      <Field label={t("Default value")}>
                        <Textarea mono value={active.value} onChange={e => app.updateVariable(active.id, { value: e.target.value })} />
                      </Field>
                      <SwitchRow label={t("Secret")} checked={active.secret === true} onChange={v => app.updateVariable(active.id, { secret: v })} />
                    </div>
                  );
                })()
              ) : (
                <EmptyState icon={Braces} title={t("No variables yet")}>
                  {t("Create your first variable to reuse data across steps.")}
                </EmptyState>
              )}
            </div>
          </Page>
        )}

        {app.tab === "library" && (
          <Page label={t("Workflows")}>
            <PageHeader
              eyebrow={t("LOCAL WORKFLOW LIBRARY")}
              title={t("Workflows")}
              description={t("Create, edit, duplicate, import and share independent workflows. Changes save locally as you edit.")}
              actions={
                <div className="row">
                  <Button variant="outline" icon={FolderOpen} onClick={app.importWorkflow}>{t("Import JSON")}</Button>
                  <Button variant="primary" icon={Plus} iconAnim="pop" onClick={app.newWorkflow}>{t("New workflow")}</Button>
                </div>
              }
            />
            <div className="workflow-library-grid">
              {app.workflowLibrary.map(item => (
                <article key={item.id} className={`card card-pad stack ${item.id === app.workflowId ? "card-active" : ""}`}>
                  <div className="row-between">
                    <span className="caption">{item.id === app.workflowId ? "CURRENT" : "SAVED"}</span>
                    {item.aiTag && <Badge tone="solid">AI</Badge>}
                  </div>
                  <h3>{item.document.name}</h3>
                  <p className="muted truncate">{item.document.startUrl || "No start URL"}</p>
                  <div className="row">
                    <Button variant="primary" size="sm" onClick={() => app.activateWorkflow(item)}>{t("Open & edit")}</Button>
                    <IconButton icon={Copy} label="Duplicate" size="sm" onClick={() => app.duplicateWorkflow(item)} />
                    <IconButton icon={Save} label="Export" size="sm" onClick={() => app.exportWorkflowFor(item)} />
                    <IconButton icon={Trash2} label="Delete" size="sm" variant="danger" disabled={app.workflowLibrary.length <= 1} onClick={() => app.deleteWorkflow(item.id)} />
                  </div>
                </article>
              ))}
            </div>
          </Page>
        )}

        {app.tab === "outputs" && (
          <Page label={t("Outputs")}>
            <PageHeader
              eyebrow={t("WORKFLOW ARTIFACTS")}
              title={t("Outputs")}
              description={t("Text, extracted data, screenshots, images and completed downloads are collected into a ZIP for this workflow.")}
              actions={<Button variant="outline" icon={RefreshCw} onClick={() => app.setOutputRefreshToken(v => v + 1)}>{t("Refresh")}</Button>}
            />
            {app.outputArchives.length === 0 ? (
              <EmptyState icon={Archive} title={t("No output ZIPs yet.")}>
                {t("Run this workflow with a screenshot, extract, save-text, or download action to generate output files.")}
              </EmptyState>
            ) : (
              <div className="output-archive-list">
                {app.outputArchives.map(archive => (
                  <div key={archive.name} className="card card-pad stack">
                    <div className="row-between">
                      <strong>{archive.name}</strong>
                      <span className="caption">{(archive.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="output-artifact-list">
                      {archive.artifacts.map(a => (
                        <div key={a.name} className="output-artifact-row">
                          <span className="truncate"><FileText size={13} /> {a.name}</span>
                          <IconButton icon={Eye} label="Preview" size="sm" onClick={async () => {
                            const res = await window.flowforge.readOutput(app.workflowId, archive.name, a.name);
                            if (res.ok) app.setOutputPreview({ archive: archive.name, name: a.name, mime: res.mime || "text/plain", data: res.data || "", text: res.text });
                          }} />
                        </div>
                      ))}
                    </div>
                    <div className="row">
                      <Button size="sm" variant="primary" icon={Download} onClick={() => window.flowforge.openOutput(app.workflowId, archive.name)}>{t("Open ZIP")}</Button>
                      <Button size="sm" variant="outline" icon={FolderOpen} onClick={() => window.flowforge.revealOutput(app.workflowId, archive.name)}>{t("Show in folder")}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {app.outputPreview && (
              <div className="card card-pad stack" style={{ marginTop: "1rem" }}>
                <div className="row-between">
                  <strong>Preview: {app.outputPreview.name}</strong>
                  <IconButton icon={Check} label="Close" size="sm" onClick={() => app.setOutputPreview(null)} />
                </div>
                {app.outputPreview.mime.startsWith("image/") ? (
                  <img src={`data:${app.outputPreview.mime};base64,${app.outputPreview.data}`} alt={app.outputPreview.name} style={{ maxHeight: 400, objectFit: "contain" }} />
                ) : (
                  <pre className="output-text-preview">{app.outputPreview.text}</pre>
                )}
              </div>
            )}
          </Page>
        )}

        {app.tab === "templates" && (
          <Page label={t("Templates")}>
            <PageHeader
              eyebrow={t("WORKFLOW STARTERS")}
              title={t("Templates")}
              description={t("Start from a practical pattern, then replace sample URLs and selectors with your own target.")}
            />
            <div className="form-grid cols-3">
              {[
                { id: "starter" as const, title: "Website smoke check", desc: "Open a page, wait for heading, assert text." },
                { id: "form" as const, title: "Form entry starter", desc: "Wait for email field, type value, submit." },
                { id: "search" as const, title: "Search page starter", desc: "Locate search box, enter query, press Enter." }
              ].map(t => (
                <div key={t.id} className="card card-pad stack">
                  <div className="empty-icon"><Sparkles size={20} /></div>
                  <h3>{t.title}</h3>
                  <p className="muted">{t.desc}</p>
                  <Button variant="primary" size="sm" onClick={() => app.applyTemplate(t.id)}>Use template</Button>
                </div>
              ))}
            </div>
          </Page>
        )}

        {app.tab === "browser" && (
          <Page label={t("Browser")}>
            <PageHeader
              eyebrow={t("WORKFLOW RECORDING")}
              title={t("Browser recorder")}
              description={t("Enter a website in the URL field above and press Record. Use the site normally, then stop recording to edit the generated workflow.")}
              actions={<Button variant="primary" icon={MousePointer2} onClick={() => void app.startRecorder()} disabled={app.running}>{t("Start recording")}</Button>}
            />
            <div className="card card-pad stack">
              <h3>{t("Record real interactions")}</h3>
              <p className="muted">{t("The recorder observes the real Chrome or Edge page without intercepting ordinary clicks. It captures element clicks, text entry, keyboard shortcuts, dropdown changes, right and double clicks, hover, scrolling, supported drag and drop, and page navigation.")}</p>
              <Note tone="primary">
                {t("Limits: browser chrome, native file-picker dialogs, CAPTCHA, canvas drawing, and some cross-origin iframe or custom-widget actions cannot be reliably captured.")}
              </Note>
            </div>
          </Page>
        )}

        {app.tab === "profiles" && (
          <Page label={t("Profiles")}>
            <PageHeader
              eyebrow={t("IDENTITY & STORAGE")}
              title={t("Browser profiles")}
              description={t("Keep browser identity separate between workflows.")}
              actions={<Button variant="primary" icon={Save} onClick={app.saveProfile}>{t("Save profile")}</Button>}
            />
            <div className="card card-pad stack" style={{ maxWidth: 640 }}>
              <Field label={t("Profile name")}>
                <Input value={app.profileName} onChange={e => app.setProfileName(e.target.value)} />
              </Field>
              <Field label={t("Browser")}>
                <Select value={app.browser} onChange={e => app.setBrowser(e.target.value)}>
                  <option value="chrome">Google Chrome</option>
                  <option value="edge">Microsoft Edge</option>
                </Select>
              </Field>
              <Field label={t("Persistent user data directory (optional)")}>
                <Input value={app.userDataDir} onChange={e => app.setUserDataDir(e.target.value)} placeholder="C:\FlowForge\profiles\work" />
              </Field>
              <div className="divider" />
              <div className="row">
                <Button variant="secondary" icon={Save} onClick={app.exportSession} disabled={!app.running}>{t("Export session JSON")}</Button>
                <Button variant="outline" icon={FolderOpen} onClick={app.importSession} disabled={!app.running}>{t("Import session JSON")}</Button>
              </div>
            </div>
          </Page>
        )}

        {app.tab === "settings" && (
          <Page label={t("Settings")}>
            <PageHeader
              eyebrow={t("ENGINE CONFIGURATION")}
              title={t("Settings")}
              description={t("Control how the automation engine behaves.")}
            />
            <div className="card card-pad stack" style={{ maxWidth: 640 }}>
              <SwitchRow label={t("Disable images")} checked={app.disableImages} onChange={app.setDisableImages} />
              <SwitchRow label={t("Disable CSS")} checked={app.disableCss} onChange={app.setDisableCss} />
              <SwitchRow label={t("Disable web fonts")} checked={app.disableFonts} onChange={app.setDisableFonts} />
              <SwitchRow label={t("Disable audio/video")} checked={app.disableMedia} onChange={app.setDisableMedia} />
              <SwitchRow label={t("Headless browser")} checked={app.headless} onChange={app.setHeadless} />
              <div className="divider" />
              <SwitchRow label={t("Repeat automatically")} description="Run on a timer while FlowForge is open" checked={app.scheduleEnabled} onChange={app.setScheduleEnabled} />
              <div className="row">
                <Input type="number" style={{ width: 100 }} value={app.scheduleEvery} onChange={e => app.setScheduleEvery(Number(e.target.value))} />
                <Select value={app.scheduleUnit} onChange={e => app.setScheduleUnit(e.target.value)}>
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                </Select>
              </div>
              <div className="divider" />
              <div className="row-between">
                <div>
                  <strong>{t("Check for updates")}</strong>
                  <p className="muted" style={{ fontSize: 12 }}>{app.updateMessage || "Checks latest stable release on GitHub"}</p>
                </div>
                <Button variant="secondary" icon={RefreshCw} iconSpinning={app.updateChecking} onClick={() => void app.checkForUpdates(true)}>
                  {app.updateChecking ? t("Checking for updates…") : t("Check for updates")}
                </Button>
              </div>
            </div>
          </Page>
        )}

        {app.tab === "history" && (
          <Page label={t("Run history")}>
            <PageHeader
              eyebrow={t("EXECUTION DIAGNOSTICS")}
              title={t("Run history")}
              description={t("Recent automation outcomes are stored locally on this device.")}
              actions={<Button variant="outline" onClick={() => app.setRunHistory([])}>{t("Clear history")}</Button>}
            />
            <div className="stack">
              {app.runHistory.map(item => (
                <div key={item.id} className="card card-pad row-between">
                  <div>
                    <strong>{item.workflow}</strong>
                    <div className="caption">{item.startedAt} · {item.durationMs ? `${(item.durationMs / 1000).toFixed(1)}s` : "In progress"}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {item.successfulSteps} {t("succeeded")} · {item.failedSteps} {t("failed")} · {item.totalSteps} {t("total")}
                    </div>
                  </div>
                  <Badge tone={item.status === "success" ? "solid" : item.status === "failed" ? "danger" : "neutral"}>
                    {item.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </Page>
        )}

        {app.tab === "logs" && (
          <Page label={t("Engine logs")}>
            <PageHeader
              eyebrow={t("DIAGNOSTICS")}
              title={t("Engine logs")}
              description={t("Live output from the local Selenium runner.")}
              actions={<Button variant="outline" onClick={() => app.setLogs([])}>{t("Clear logs")}</Button>}
            />
            <div className="console" style={{ minHeight: 480 }}>
              {app.logs.map((l, i) => (
                <div key={i} className="log-line">
                  <span>{String(i + 1).padStart(3, "0")}</span>
                  <code>{l}</code>
                </div>
              ))}
            </div>
          </Page>
        )}

        {app.tab === "ai" && (
          <Page label="AI Studio">
            <PageHeader
              eyebrow="FLOWFORGE INTELLIGENCE"
              title="AI Studio"
              description="Connect an AI agent, inspect workflow dependency graphs, and turn guided sessions into automation."
            />
            <div className="form-grid cols-2">
              <div className="card card-pad stack">
                <h3>9Router Local Provider</h3>
                <p className="muted">Connect an OpenAI-compatible agent endpoint.</p>
                <Field label="API Base URL">
                  <Input defaultValue="http://localhost:20128/v1" />
                </Field>
                <Field label="Model Identifier">
                  <Input defaultValue="MCP" />
                </Field>
                <div className="row">
                  <Button variant="primary">Save Provider</Button>
                  <Button variant="secondary">Test Connection</Button>
                </div>
              </div>
              <div className="card card-pad stack">
                <h3>Workflow Graph</h3>
                <p className="muted">{app.workflowLibrary.length} workflows in local library</p>
                <div className="stack" style={{ maxHeight: 220, overflow: "auto" }}>
                  {app.workflowLibrary.map(w => (
                    <div key={w.id} className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <span><Workflow size={13} /> {w.document.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => app.activateWorkflow(w)}>Edit</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Page>
        )}
      </div>

      <StatusBar app={app} panels={panels} />

      {/* Global Command Palette */}
      <Dialog
        open={app.commandOpen}
        onClose={() => app.setCommandOpen(false)}
        labelledBy="cmd-title"
        position="top"
        className="dialog-flush"
      >
        <div className="command-search-row">
          <Search size={16} />
          <input
            ref={app.commandInputRef}
            placeholder={t("Search commands…")}
            value={app.commandQuery}
            onChange={e => app.setCommandQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && filteredCommands[0]) {
                e.preventDefault(); filteredCommands[0].run();
              }
            }}
          />
        </div>
        <div className="command-results" role="listbox" id="cmd-title">
          {filteredCommands.map(item => (
            <button key={item.label} className="command-result" onClick={item.run}>
              <span>
                <strong>{t(item.label)}</strong>
                <small>{t(item.detail)}</small>
              </span>
              <span className="command-enter">↵</span>
            </button>
          ))}
        </div>
      </Dialog>

      {/* Interactive User Input Modal */}
      {app.userInputPrompt && (
        <Dialog open onClose={() => void app.cancelUserInput()} labelledBy="user-input-title" dismissible={false}>
          <div className="stack" style={{ gap: "1rem" }}>
            <div className="empty-icon"><Braces size={20} /></div>
            <h2 id="user-input-title">{app.userInputPrompt.stepName}</h2>
            <p className="muted">{t("Enter the values below to continue the workflow.")}</p>
            {app.userInputPrompt.fields.map(f => (
              <Field key={f.id} label={f.title}>
                <Input
                  type={f.secret ? "password" : "text"}
                  value={app.userInputPrompt!.values[f.id] || ""}
                  onChange={e => app.setUserInputPrompt(p => p ? { ...p, values: { ...p.values, [f.id]: e.target.value } } : p)}
                />
              </Field>
            ))}
            {app.userInputPrompt.error && <Note tone="danger">{app.userInputPrompt.error}</Note>}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: "1rem" }}>
              <Button variant="secondary" onClick={() => void app.cancelUserInput()}>{t("Cancel")}</Button>
              <Button variant="primary" onClick={() => void app.submitUserInput()}>{t("Continue")}</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
