import { Check, MessageSquareText, ShieldCheck } from "lucide-react";
import type { AppController } from "../state/useAppController";
import { Button, Dialog, Field, Icon, Input, Note, Select } from "../components";

/** Pop-up shown when a running workflow needs the user to type a value or make a choice. */
export function UserInputDialog({ app }: { app: AppController }) {
  const { t, userInputPrompt: prompt, setUserInputPrompt } = app;
  if (!prompt) return null;
  const setValue = (id: string, value: string) => setUserInputPrompt(current => (current ? { ...current, values: { ...current.values, [id]: value }, error: undefined } : current));
  return (
    <Dialog open onClose={() => void app.cancelUserInput()} labelledBy="user-input-title">
      <div className="dialog-head">
        <span className="dialog-icon"><Icon icon={MessageSquareText} size={20} anim="pop" /></span>
        <div className="eyebrow">{t("FLOWFORGE NEEDS YOUR INPUT")}</div>
        <h2 id="user-input-title" style={{ fontSize: 20 }}>{prompt.stepName}</h2>
        <p className="card-desc">{t("Enter the values below. FlowForge will place each value into its configured webpage field and continue the workflow.")}</p>
      </div>
      <form onSubmit={event => { event.preventDefault(); void app.submitUserInput(); }}>
        <div className="prompt-fields">
          {prompt.fields.map((field, index) => (
            <Field key={field.id} label={<>{field.title}{field.required && <b aria-hidden="true"> *</b>}</>}>
              {field.valueType === "boolean" || field.valueType === "choice" ? (
                <Select data-autofocus={index === 0 ? "" : undefined} aria-label={field.title} value={prompt.values[field.id] || ""} required={field.required} onChange={event => setValue(field.id, event.target.value)}>
                  <option value="">{field.valueType === "boolean" ? t("Choose true or false") : t("Choose an option")}</option>
                  {(field.valueType === "boolean" ? ["true", "false"] : field.options || []).map(option => <option key={option} value={option}>{field.valueType === "boolean" ? (option === "true" ? t("True") : t("False")) : option}</option>)}
                </Select>
              ) : (
                <Input
                  data-autofocus={index === 0 ? "" : undefined}
                  type={field.secret ? "password" : field.valueType === "number" ? "number" : "text"}
                  pattern={field.pattern || undefined}
                  value={prompt.values[field.id] || ""}
                  placeholder={field.placeholder || t("Enter a value")}
                  required={field.required}
                  onChange={event => setValue(field.id, event.target.value)}
                />
              )}
            </Field>
          ))}
          {prompt.error && <Note tone="danger">{prompt.error}</Note>}
        </div>
        <div className="dialog-actions">
          <Button onClick={() => void app.cancelUserInput()}>{t("Cancel workflow step")}</Button>
          <Button variant="primary" type="submit" icon={Check} iconAnim="draw">{t("Continue workflow")}</Button>
        </div>
      </form>
      <div className="dialog-foot"><Icon icon={ShieldCheck} size={13} />{t("Values are sent only to the local FlowForge engine and are not added to run logs.")}</div>
    </Dialog>
  );
}
