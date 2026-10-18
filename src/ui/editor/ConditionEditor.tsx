import type { AppController, Step } from "../state/useAppController";
import { Field, Input, Select } from "../components";

type Condition = NonNullable<Step["condition"]>;
const SOURCES: Array<[Condition["source"], string]> = [["variable", "Workflow variable"], ["lastText", "Last extracted text"], ["url", "Current URL"], ["urlChanged", "Did the URL change?"], ["stepStatus", "Previous action result"]];
const OPERATORS: Condition["operator"][] = ["equals", "notEquals", "contains", "notContains", "matches", "greaterThan", "lessThan", "truthy", "falsy"];

/** Shared "value → operator → expected" editor for If/else and While blocks. */
export function ConditionEditor({ app }: { app: AppController }) {
  const { current, update, steps, t } = app;
  if (!current) return null;
  const condition = current.condition;
  const source = condition?.source || "lastText";
  const earlier = steps.slice(0, Math.max(0, steps.findIndex(item => item.id === current.id)));

  return (
    <>
      <Field label={t("Value to check")}>
        <Select
          value={source}
          onChange={event => {
            const next = event.target.value as Condition["source"];
            update({
              condition: {
                source: next,
                operator: next === "stepStatus" || next === "urlChanged" ? "equals" : current.condition?.operator || "contains",
                key: current.condition?.key,
                expected: next === "stepStatus" ? "success" : next === "urlChanged" ? "true" : current.condition?.expected || "",
              },
            });
          }}
        >
          {SOURCES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
        </Select>
      </Field>

      {(source === "variable" || source === "stepStatus") && (
        <Field label={t("Variable / step id")}>
          {source === "stepStatus" ? (
            <Select value={condition?.key || ""} onChange={event => update({ condition: { ...(condition || { source: "stepStatus", operator: "equals" }), key: event.target.value } })}>
              <option value="">{t("Choose an earlier action…")}</option>
              {earlier.map(item => <option key={item.id} value={item.id}>{item.name || item.type} · {item.id.slice(0, 8)}</option>)}
            </Select>
          ) : (
            <Input mono value={condition?.key || ""} onChange={event => update({ condition: { ...(condition || { source: "variable", operator: "equals" }), key: event.target.value } })} placeholder="variableName" />
          )}
        </Field>
      )}

      <div className="condition-pair">
        <Field label={t("Operator")}>
          <Select value={condition?.operator || "contains"} onChange={event => update({ condition: { ...(condition || { source: "lastText" }), operator: event.target.value as Condition["operator"] } as Condition })}>
            {OPERATORS.map(value => <option key={value} value={value}>{t(value)}</option>)}
          </Select>
        </Field>
        <Field label={t("Expected value")}>
          {source === "stepStatus" ? (
            <Select value={condition?.expected || "success"} onChange={event => update({ condition: { ...(condition || { source: "stepStatus", operator: "equals" }), expected: event.target.value } as Condition })}>
              <option value="success">{t("Succeeded")}</option>
              <option value="error">{t("Failed")}</option>
              <option value="skipped">{t("Skipped")}</option>
            </Select>
          ) : source === "urlChanged" ? (
            <Select value={condition?.expected || "true"} onChange={event => update({ condition: { ...(condition || { source: "urlChanged", operator: "equals" }), expected: event.target.value } as Condition })}>
              <option value="true">{t("Changed")}</option>
              <option value="false">{t("Did not change")}</option>
            </Select>
          ) : (
            <Input value={condition?.expected || ""} onChange={event => update({ condition: { ...(condition || { source: "lastText", operator: "contains" }), expected: event.target.value } as Condition })} placeholder={t("Value to compare")} />
          )}
        </Field>
      </div>
    </>
  );
}
