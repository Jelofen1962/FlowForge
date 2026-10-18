import { ArrowDown, ArrowUp, Braces, CircleCheck, Copy, Plus, ShieldAlert, SlidersHorizontal, Target, Trash2, TriangleAlert, Variable, Wrench, type LucideIcon } from "lucide-react";
import type { OnErrorPolicy, WorkflowVariable } from "../../core/workflow";
import { getActionIcon, getActionLabel } from "../data/actionCatalog";
import { makeStep, type AppController } from "../state/useAppController";
import { ActionPicker, Badge, Button, CheckRow, EmptyState, Field, Hint, Icon, IconButton, Input, Section, Select, SwitchRow } from "../components";
import { ActionSettings, LOCATOR_STEP_TYPES, TargetFields, hasActionSettings } from "./StepFields";
import { Layers } from "lucide-react";

/** Centre column: configuration of the currently selected step, split into collapsible numbered sections. */
export function Inspector({ app }: { app: AppController }) {
  const { current, t, steps, validation } = app;

  if (!current) {
    return (
      <div className="canvas"><div className="canvas-inner">
        <EmptyState icon={Layers} title={t("No step selected")} action={<Button variant="primary" icon={Plus} iconAnim="rotate" onClick={() => app.addStep()}>{t("Add step")}</Button>}>
          {t("Add a step to begin building your workflow.")}
        </EmptyState>
      </div></div>
    );
  }

  const index = steps.findIndex(step => step.id === current.id);
  const GlyphIcon: LucideIcon = getActionIcon(current.type);
  const hasTarget = LOCATOR_STEP_TYPES.includes(current.type);
  let n = 1;
  const num = () => String(n++).padStart(2, "0");

  return (
    <>
      <header className="inspector-head">
        <span className="inspector-glyph"><Icon icon={GlyphIcon} size={19} anim="pop" /></span>
        <div className="inspector-title">
          <div className="eyebrow">{t("STEP CONFIGURATION")} · {String(index + 1).padStart(2, "0")}/{String(steps.length).padStart(2, "0")}</div>
          <h2>{current.name || t("Untitled step")}</h2>
        </div>
        <Badge tone={validation.valid ? "primary" : "danger"} icon={validation.valid ? CircleCheck : TriangleAlert}>{validation.valid ? t("Valid") : `${validation.errors.length}`}</Badge>
        <div className="inspector-tools">
          <IconButton icon={ArrowUp} iconAnim="bounce" label={t("Move up")} disabled={index <= 0} onClick={() => app.move(-1)} />
          <IconButton icon={ArrowDown} iconAnim="drop" label={t("Move down")} disabled={index >= steps.length - 1} onClick={() => app.move(1)} />
          <IconButton icon={Copy} iconAnim="pop" label={t("Duplicate step")} onClick={app.duplicateStep} />
          <IconButton icon={Trash2} iconAnim="wiggle" label={t("Delete step")} tipSide="end" onClick={() => app.deleteStep(current.id)} />
        </div>
      </header>

      <div className="canvas">
        <div className="canvas-inner">
          {!validation.valid && (
            <div className="validation has-errors" role="alert">
              <div className="validation-title"><Icon icon={ShieldAlert} size={16} />{t("Workflow needs attention")}</div>
              <ul>{validation.errors.slice(0, 8).map((error, i) => <li className="err" key={`${i}-${error}`}>{error}</li>)}</ul>
            </div>
          )}

          <Section index={num()} icon={SlidersHorizontal} title={t("General")}>
            <div className="form-grid cols-2">
              <Field label={t("Step name")}><Input value={current.name} onChange={event => app.update({ name: event.target.value })} /></Field>
              <Field label={t("Group")}>
                <Select value={current.groupId || ""} onChange={event => app.update({ groupId: event.target.value || undefined })}>
                  <option value="">{t("Ungrouped")}</option>
                  {app.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field as="div" label={t("Action type")}>
              <ActionPicker t={t} label={t("Action type")} value={current.type} onChange={type => app.update({ ...makeStep(type), id: current.id, groupId: current.groupId, name: t(getActionLabel(type)) })} />
            </Field>
          </Section>

          {hasTarget && <Section index={num()} icon={Target} title={t("Target")}><TargetFields app={app} /></Section>}

          {hasActionSettings(current.type) && <Section index={num()} icon={Wrench} title={t("Action settings")}><ActionSettings app={app} /></Section>}

          <Section index={num()} icon={SlidersHorizontal} title={t("Reliability")} defaultOpen={false}>
            {current.type !== "navigate" && (
              <Field label={t("Timeout (ms)")}><Input type="number" value={current.timeout || 10000} onChange={event => app.update({ timeout: Number(event.target.value) })} /></Field>
            )}
            <div className="form-grid cols-3">
              <Field label={t("On error")}>
                <Select value={current.onError || "stop"} onChange={event => app.update({ onError: event.target.value as OnErrorPolicy })}>
                  <option value="stop">{t("Stop workflow")}</option>
                  <option value="continue">{t("Continue to next step")}</option>
                </Select>
              </Field>
              <Field label={t("Retry attempts")}>
                <Input type="number" min="1" max="10" aria-label={t("Retry attempts")} value={current.retry?.attempts ?? 1} onChange={event => {
                  const attempts = Math.max(1, Math.min(10, Number(event.target.value) || 1));
                  app.update({ retry: attempts > 1 || current.retry ? { attempts, delayMs: current.retry?.delayMs ?? 500 } : undefined });
                }} />
              </Field>
              <Field label={t("Delay between retries (ms)")}>
                <Input type="number" min="0" max="30000" aria-label={t("Retry delay in milliseconds")} value={current.retry?.delayMs ?? 500} onChange={event => app.update({ retry: { attempts: current.retry?.attempts ?? 1, delayMs: Math.max(0, Math.min(30000, Number(event.target.value) || 0)) } })} />
              </Field>
            </div>
            <SwitchRow label={t("Disable this step")} description={t("Skipped during runs; kept in the workflow.")} checked={!!current.disabled} onChange={value => app.update({ disabled: value })} />
            <Hint>Selenium WebDriver · {t("Step ID")}: <code>{current.id.slice(0, 8)}</code></Hint>
          </Section>

          <Section
            index={num()}
            icon={Variable}
            title={`${t("WORKFLOW VARIABLES")} · ${app.variables.length}`}
            defaultOpen={false}
            actions={<Button size="sm" variant="ghost" icon={Braces} onClick={() => app.setTab("variables")}>{t("Open variable manager")}</Button>}
          >
            <Hint>{t("Variables persist with this workflow. Reference values in text fields with")} <code>{"${variableName}"}</code></Hint>
            {app.variables.map(v => <VariableRow key={v.id} app={app} v={v} />)}
            <div><Button size="sm" icon={Plus} iconAnim="rotate" onClick={app.addVariable}>{t("Add variable")}</Button></div>
          </Section>
        </div>
      </div>
    </>
  );
}

function VariableRow({ app, v }: { app: AppController; v: WorkflowVariable }) {
  const { t, setVariables } = app;
  const patch = (change: Partial<WorkflowVariable>) => setVariables(all => all.map(x => (x.id === v.id ? { ...x, ...change } : x)));
  return (
    <div className="var-row">
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <Input sm mono value={v.name} aria-label={t("Variable name")} onChange={event => patch({ name: event.target.value })} placeholder="name" />
        <Input sm value={v.value} aria-label={t("Variable default value")} onChange={event => patch({ value: event.target.value })} placeholder={t("default value")} />
        <IconButton size="sm" icon={Trash2} iconAnim="wiggle" label={t("Delete variable")} onClick={() => setVariables(all => all.filter(x => x.id !== v.id))} />
      </div>
      <div className="var-row-grid">
        <Select sm aria-label={t("Variable type")} value={v.valueType || "text"} onChange={event => patch({ valueType: event.target.value as WorkflowVariable["valueType"] })}>
          <option value="text">{t("Text")}</option><option value="number">{t("Number")}</option><option value="boolean">{t("Boolean")}</option><option value="json">{t("JSON")}</option>
        </Select>
        <Select sm aria-label={t("Variable scope")} value={v.scope || "workflow"} onChange={event => patch({ scope: event.target.value as WorkflowVariable["scope"] })}>
          <option value="workflow">{t("Workflow default")}</option><option value="run">{t("Run value")}</option>
        </Select>
      </div>
      <Input sm value={v.description || ""} aria-label={t("Variable description")} onChange={event => patch({ description: event.target.value })} placeholder={t("Description (optional)")} />
      <CheckRow label={t("Secret")} checked={v.secret === true} onChange={value => patch({ secret: value })} />
    </div>
  );
}
