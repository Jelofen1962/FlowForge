import { useState } from "react";
import { Braces, Copy, Layers, Lock, Plus, Search, ShieldCheck, Trash2, Variable } from "lucide-react";
import type { WorkflowVariable } from "../../core/workflow";
import type { AppController } from "../state/useAppController";
import { Badge, Button, EmptyState, Field, Hint, Icon, IconButton, Input, Select, Textarea, SwitchRow, ResizeHandle } from "../components";
import { Page, PageHeader } from "../layout/Page";

export function VariablesView({ app }: { app: AppController }) {
  const { t, variables, variableSearch, selectedVariableId } = app;
  const [listWidth, setListWidth] = useState(280);
  const match = (v: WorkflowVariable) => `${v.name} ${v.description || ""} ${v.valueType || "text"}`.toLowerCase().includes(variableSearch.toLowerCase());
  const visible = variables.filter(match);
  const v = variables.find(x => x.id === selectedVariableId) || visible[0] || variables[0];
  const invalidName = v ? app.variableNameError(v) : false;
  let jsonValid = true;
  if (v?.valueType === "json" && v.value.trim()) { try { JSON.parse(v.value); } catch { jsonValid = false; } }
  const ref = v ? "${" + v.name + "}" : "";

  return (
    <Page label={t("Variables")}>
      <PageHeader
        eyebrow={t("WORKFLOW DATA CENTER")}
        title={t("Variables")}
        description={<>{t("Manage every value used by this workflow")} · <strong>{app.workflowName}</strong></>}
        actions={<>
          <Button variant="primary" icon={Plus} iconAnim="rotate" onClick={app.addVariable}>{t("Add variable")}</Button>
          <Button icon={Layers} iconAnim="nudge" onClick={() => app.setTab("workflow")}>{t("Editor")}</Button>
        </>}
      />

      <div className="stat-grid">
        <div className="card stat"><span>{t("Total variables")}</span><strong>{variables.length}</strong><small>{t("Configured defaults")}</small></div>
        <div className="card stat"><span>{t("Run value")}</span><strong>{variables.filter(x => x.scope === "run").length}</strong><small>{t("Reset for each execution")}</small></div>
        <div className="card stat"><span>{t("Secret")}</span><strong>{variables.filter(x => x.secret).length}</strong><small>{t("Secrets are masked in this editor but are not encrypted by this setting.")}</small></div>
      </div>

      {variables.length === 0 ? (
        <EmptyState icon={Variable} title={t("No variables yet")} action={<Button variant="primary" icon={Plus} iconAnim="rotate" onClick={app.addVariable}>{t("Add variable")}</Button>}>
          {t("Create your first variable to reuse data across steps.")}
        </EmptyState>
      ) : (
        <div className="split">
          <div className="split-list" style={{ width: listWidth }}>
            <div className="split-head"><span>{t("Variable details")}</span><Badge>{visible.length} / {variables.length}</Badge></div>
            <div style={{ padding: "0.5rem 0.5rem 0" }}>
              <div className="input-group">
                <Icon icon={Search} size={14} />
                <Input sm value={variableSearch} onChange={event => app.setVariableSearch(event.target.value)} placeholder={t("Search variables")} aria-label={t("Search variables")} />
              </div>
            </div>
            <div className="split-list-body">
              {visible.map(item => (
                <button key={item.id} type="button" className="list-item" aria-current={v?.id === item.id} onClick={() => app.setSelectedVariableId(item.id)}>
                  <span className="tile-glyph"><Icon icon={Braces} size={15} /></span>
                  <span className="list-item-copy"><strong>{item.name || t("unnamed")}</strong><small>{item.valueType || "text"} · {item.scope || "workflow"}</small></span>
                  {item.secret && <Icon icon={Lock} size={13} />}
                </button>
              ))}
              {visible.length === 0 && <p className="muted" style={{ padding: "0.8rem" }}>{t("No matching variables.")}</p>}
            </div>
          </div>
          <ResizeHandle label={t("Resize variable list")} value={listWidth} min={200} max={460} invert={app.language === "fa"} onChange={setListWidth} onReset={() => setListWidth(280)} />

          {v && (
            <div className="split-detail">
              <div className="row-between">
                <div>
                  <div className="eyebrow">{t("Variable details")}</div>
                  <h2 style={{ fontSize: 20, marginTop: 4 }}>{v.name || t("unnamed")}</h2>
                </div>
                <div className="row">
                  <IconButton variant="outline" icon={Copy} iconAnim="pop" label={t("Duplicate variable")} onClick={() => app.duplicateVariable(v)} />
                  <IconButton variant="danger" icon={Trash2} iconAnim="wiggle" label={t("Delete variable")} tipSide="end" onClick={() => { app.setVariables(all => all.filter(x => x.id !== v.id)); app.setSelectedVariableId(variables.find(x => x.id !== v.id)?.id || ""); }} />
                </div>
              </div>

              <Field label={t("Variable name")} error={invalidName ? t("Variable name must be unique and use letters, numbers, and underscores.") : undefined} hint={invalidName ? undefined : <>{t("Use")} <code>{"${variableName}"}</code> {t("in text fields to reference this value.")}</>}>
                <Input mono aria-invalid={invalidName} value={v.name} onChange={event => app.updateVariable(v.id, { name: event.target.value })} placeholder="customer_id" />
              </Field>
              <div className="form-grid cols-2">
                <Field label={t("Variable type")}>
                  <Select value={v.valueType || "text"} onChange={event => app.updateVariable(v.id, { valueType: event.target.value as WorkflowVariable["valueType"] })}>
                    <option value="text">{t("Text")}</option><option value="number">{t("Number")}</option><option value="boolean">{t("Boolean")}</option><option value="json">{t("JSON")}</option>
                  </Select>
                </Field>
                <Field label={t("Variable scope")}>
                  <Select value={v.scope || "workflow"} onChange={event => app.updateVariable(v.id, { scope: event.target.value as WorkflowVariable["scope"] })}>
                    <option value="workflow">{t("Workflow default")}</option><option value="run">{t("Run value")}</option>
                  </Select>
                </Field>
              </div>
              <Field
                label={t("Default value")}
                error={v.valueType === "json" && !jsonValid ? t("Invalid JSON") : v.valueType === "number" && v.value.trim() && Number.isNaN(Number(v.value)) ? t("Expected a valid number.") : undefined}
                hint={v.valueType === "json" && jsonValid && v.value.trim() ? t("Valid JSON") : undefined}
              >
                {v.valueType === "boolean" ? (
                  <Select value={v.value} onChange={event => app.updateVariable(v.id, { value: event.target.value })}>
                    <option value="">{t("Unset")}</option><option value="true">true</option><option value="false">false</option>
                  </Select>
                ) : (
                  <Textarea mono style={{ minHeight: 110 }} value={v.value} onChange={event => app.updateVariable(v.id, { value: event.target.value })} placeholder={v.valueType === "json" ? '{"key":"value"}' : v.valueType === "number" ? "0" : t("Enter a default value")} spellCheck={v.valueType === "json"} />
                )}
              </Field>
              <Field label={t("Description")}><Textarea value={v.description || ""} onChange={event => app.updateVariable(v.id, { description: event.target.value })} placeholder={t("What is this value used for?")} /></Field>
              <SwitchRow label={t("Secret")} description={t("Secrets are masked in this editor but are not encrypted by this setting.")} checked={v.secret === true} onChange={value => app.updateVariable(v.id, { secret: value })} />
              <div className="ref-box">
                <div><div className="caption">{t("Reference")}</div><code>{ref}</code></div>
                <Button size="sm" icon={Copy} iconAnim="pop" onClick={() => void navigator.clipboard?.writeText(ref)}>{t("Copy reference")}</Button>
              </div>
            </div>
          )}
        </div>
      )}
      <Hint icon={<Icon icon={ShieldCheck} size={13} />}>{t("Workflow variables are saved with this workflow. Run-scoped values are reset for each execution.")}</Hint>
    </Page>
  );
}

