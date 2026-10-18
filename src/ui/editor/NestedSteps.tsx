import { Braces, Plus, Trash2 } from "lucide-react";
import type { LocatorStrategy, StepType, WorkflowStep } from "../../core/workflow";
import { getActionLabel } from "../data/actionCatalog";
import { makeStep, type AppController } from "../state/useAppController";
import { ActionPicker, Button, Icon, IconButton, Input, Select } from "../components";

export type NestedField = "thenSteps" | "elseSteps" | "loopSteps";

const LOCATOR_TYPES: StepType[] = ["click", "type", "key", "hover", "rightClick", "doubleClick", "dragDrop", "scrollTo", "waitVisible", "waitClickable", "assertText", "select", "uploadFile", "extractText", "extractAttribute", "extractValue", "extractTable", "saveImage", "assertExists", "assertCount", "assertAttribute", "switchFrame"];
const STRATEGIES: LocatorStrategy[] = ["css", "xpath", "id", "name", "linkText", "className", "tagName"];

/** Editable list of child actions for if/else branches and loop bodies. */
export function NestedSteps({ app, field, label }: { app: AppController; field: NestedField; label: string }) {
  const { current, t, addNested, patchNested, removeNested } = app;
  const nested = (current?.[field] || []) as WorkflowStep[];
  return (
    <section className="nested" aria-label={label}>
      <div className="nested-head">
        <strong>{label}</strong>
        <span className="muted">{nested.length} {t(nested.length === 1 ? "step" : "steps")}</span>
        <span className="grow" />
        <Button size="sm" variant="outline" icon={Plus} iconAnim="rotate" onClick={() => addNested(field, "click")} aria-label={`${t("Add action")}: ${label}`}>
          {t("Add action")}
        </Button>
      </div>
      {nested.length === 0 ? (
        <div className="nested-empty">
          <Icon icon={Braces} size={16} />
          <span>{t("No actions in this branch yet.")} {t("Add an action to define what happens here.")}</span>
        </div>
      ) : (
        <ol className="nested-list">
          {nested.map((child, index) => (
            <li className="nested-item" key={child.id}>
              <span className="nested-no">{index + 1}</span>
              <div className="nested-fields">
                <ActionPicker
                  compact
                  t={t}
                  label={t("Nested action type")}
                  value={child.type}
                  onChange={type => patchNested(field, child.id, { ...makeStep(type), id: child.id, name: getActionLabel(type) })}
                />
                <Input sm aria-label={t("Nested step name")} value={child.name} onChange={event => patchNested(field, child.id, { name: event.target.value })} placeholder={t("Action name")} />
                {(child.type === "navigate" || child.type === "openTab") && (
                  <Input sm mono aria-label={t("Nested URL")} value={child.url || ""} onChange={event => patchNested(field, child.id, { url: event.target.value })} placeholder="https://example.com" />
                )}
                {LOCATOR_TYPES.includes(child.type) && child.target && (
                  <div className="nested-locator">
                    <Select sm aria-label={t("Nested locator strategy")} value={child.target.strategy} onChange={event => patchNested(field, child.id, { target: { ...child.target!, strategy: event.target.value as LocatorStrategy } })}>
                      {STRATEGIES.map(value => <option key={value}>{value}</option>)}
                    </Select>
                    <Input sm mono aria-label={t("Nested locator")} value={child.target.value} onChange={event => patchNested(field, child.id, { target: { ...child.target!, value: event.target.value } })} placeholder={t("CSS selector or XPath")} />
                  </div>
                )}
                {["type", "key", "saveText", "select"].includes(child.type) && (
                  <Input sm aria-label={t("Nested text value")} value={child.text || ""} onChange={event => patchNested(field, child.id, { text: event.target.value })} placeholder={child.type === "saveText" ? t("Text to save") : t("Text or value")} />
                )}
              </div>
              <IconButton size="sm" icon={Trash2} iconAnim="wiggle" label={t("Remove nested step")} variant="ghost" onClick={() => removeNested(field, child.id)} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
