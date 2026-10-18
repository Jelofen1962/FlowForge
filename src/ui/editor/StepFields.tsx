import { Braces, CircleHelp, FolderOpen, Layers, Plus, RefreshCw, Trash2 } from "lucide-react";
import { createId, type LocatorStrategy, type UserInputField, type WorkflowStep } from "../../core/workflow";
import type { AppController, Step } from "../state/useAppController";
import { Button, CheckRow, Field, Hint, Icon, IconButton, Input, Select, Textarea } from "../components";
import { ConditionEditor } from "./ConditionEditor";
import { NestedSteps } from "./NestedSteps";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const LOCATOR_STEP_TYPES = ["click", "type", "waitVisible", "waitClickable", "assertText", "select", "hover", "rightClick", "doubleClick", "dragDrop", "scrollTo", "uploadFile", "extractText", "extractAttribute", "extractValue", "extractTable", "saveImage", "assertExists", "assertCount", "assertAttribute", "switchFrame", "extractAll", "operateAll"];
const STRATEGIES: LocatorStrategy[] = ["xpath", "css", "id", "name", "linkText", "className", "tagName"];
const DEST_STRATEGIES: LocatorStrategy[] = ["css", "xpath", "id", "name", "className", "tagName"];

function BlockHead({ icon, caption, title, text }: { icon: LucideIcon; caption: string; title: string; text?: string }) {
  return (
    <div className="block-head">
      <span className="block-glyph"><Icon icon={icon} size={17} anim="pop" /></span>
      <div>
        <div className="caption">{caption}</div>
        <h3>{title}</h3>
        {text && <p>{text}</p>}
      </div>
    </div>
  );
}

const Block = ({ children }: { children: ReactNode }) => <div className="sub-card">{children}</div>;

/** The locator ("Target") controls for steps that act on a page element. */
export function TargetFields({ app }: { app: AppController }) {
  const { current, update, t } = app;
  if (!current) return null;
  return (
    <>
      <Field
        as="div"
        label={t("Target locator")}
        action={<Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => app.setTab("browser")}>{t("Record selector")}</Button>}
      >
        <div className="locator-row">
          <Select aria-label={t("Locator strategy")} value={current.target?.strategy || "css"} onChange={event => update({ target: { ...current.target, strategy: event.target.value as LocatorStrategy } })}>
            {STRATEGIES.map(value => <option key={value} value={value}>{t(value)}</option>)}
          </Select>
          <Input mono aria-label={t("Locator value")} value={current.target?.value || ""} onChange={event => update({ target: { ...current.target, value: event.target.value } })} placeholder="//button[@id='submit']" />
        </div>
      </Field>
      <Hint icon={<Icon icon={CircleHelp} size={13} />}>{t("XPath and CSS selectors are supported. Use Record selector to capture a page element.")}</Hint>
    </>
  );
}

function UserInputConfig({ app, current }: { app: AppController; current: Step }) {
  const { update, t } = app;
  const inputs = current.inputs || [];
  const patch = (id: string, change: Partial<UserInputField>) => update({ inputs: inputs.map(item => (item.id === id ? { ...item, ...change } : item)) });
  const patchTarget = (id: string, change: Partial<UserInputField["target"]>) => update({ inputs: inputs.map(item => (item.id === id ? { ...item, target: { ...item.target, ...change } } : item)) });
  return (
    <>
      <BlockHead icon={Braces} caption={t("POP-UP INPUT FIELDS")} title={t("Ask user for inputs")} text={t("Save answers directly to variables, optionally type them into webpage fields, and validate choices or regex patterns.")} />
      {inputs.map((field, index) => (
        <Block key={field.id}>
          <div className="sub-card-head">
            <strong>{t("Input")} {index + 1}</strong>
            <IconButton size="sm" icon={Trash2} iconAnim="wiggle" label={t("Remove input")} disabled={inputs.length <= 1} onClick={() => update({ inputs: inputs.filter(item => item.id !== field.id) })} />
          </div>
          <div className="form-grid cols-2">
            <Field label={t("Input title")}><Input value={field.title} placeholder={t("e.g. Account email")} onChange={event => patch(field.id, { title: event.target.value })} /></Field>
            <Field label={t("Placeholder text")}><Input value={field.placeholder || ""} placeholder={t("Shown inside the pop-up")} onChange={event => patch(field.id, { placeholder: event.target.value })} /></Field>
            <Field label={t("Input type")}>
              <Select value={field.valueType || "text"} onChange={event => patch(field.id, { valueType: event.target.value as UserInputField["valueType"] })}>
                <option value="text">{t("Text")}</option>
                <option value="number">{t("Number")}</option>
                <option value="boolean">{t("True / false")}</option>
                <option value="choice">{t("Multiple choice")}</option>
                <option value="regex">{t("Regex-validated text")}</option>
              </Select>
            </Field>
            <Field label={t("Regex pattern (optional)")}><Input mono value={field.pattern || ""} onChange={event => patch(field.id, { pattern: event.target.value || undefined })} placeholder="^[A-Z]{2}\d{4}$" /></Field>
          </div>
          {field.valueType === "choice" && (
            <Field label={t("Choice options (one per line)")}>
              <Textarea value={(field.options || []).join("\n")} onChange={event => patch(field.id, { options: event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean) })} placeholder={"Continue\nRetry\nCancel\nSkip"} />
            </Field>
          )}
          <Field label={t("Save answer to variable (optional)")}><Input mono value={field.variableName || ""} onChange={event => patch(field.id, { variableName: event.target.value.trim() || undefined })} placeholder="user_choice" /></Field>
          <Field as="div" label={t("Destination element")}>
            <div className="locator-row">
              <Select aria-label={`${t("Input")} ${index + 1} ${t("locator strategy")}`} value={field.target?.strategy || "css"} onChange={event => patchTarget(field.id, { strategy: event.target.value as LocatorStrategy })}>
                {DEST_STRATEGIES.map(strategy => <option key={strategy}>{strategy}</option>)}
              </Select>
              <Input mono aria-label={`${t("Input")} ${index + 1} ${t("destination locator")}`} value={field.target?.value || ""} placeholder={t("Optional: #email or //input[@name='email']")} onChange={event => patchTarget(field.id, { value: event.target.value })} />
            </div>
          </Field>
          <div className="row">
            <CheckRow label={t("Required")} checked={field.required !== false} onChange={value => patch(field.id, { required: value })} />
            <CheckRow label={t("Hide value in pop-up")} checked={field.secret === true} onChange={value => patch(field.id, { secret: value })} />
          </div>
        </Block>
      ))}
      <Button variant="outline" icon={Plus} iconAnim="rotate" onClick={() => update({ inputs: [...inputs, { id: createId(), title: `${t("Input")} ${inputs.length + 1}`, placeholder: "Enter a value", required: true, secret: false, valueType: "text", target: { strategy: "css", value: "" } }] })}>
        {t("Add another input")}
      </Button>
    </>
  );
}

/** Type-specific settings for the selected step. Returns null when a step has nothing extra to configure. */
export function ActionSettings({ app }: { app: AppController }) {
  const { current, update, t, workflowLibrary, workflowId, profiles, workflowProfileName, sessionNamesByProfile, refreshSessions, setLogs } = app;
  if (!current) return null;
  const type = current.type;
  const sessionProfile = current.profileName || workflowProfileName;
  const sessionNames = sessionNamesByProfile[sessionProfile] || [];

  return (
    <>
      {(type === "navigate" || type === "openTab") && (
        <Field label={t("URL")}><Input mono value={current.url || ""} onChange={event => update({ url: event.target.value })} placeholder="https://example.com" /></Field>
      )}

      {type === "type" && (
        <>
          <Field label={t("Text to type")}><Textarea value={current.text || ""} onChange={event => update({ text: event.target.value })} /></Field>
          <CheckRow label={t("Clear field before typing")} checked={current.clearFirst !== false} onChange={value => update({ clearFirst: value })} />
        </>
      )}

      {type === "key" && (
        <Field label={t("Key / shortcut")} hint={t("Selenium key names are supported, e.g. ENTER, TAB, ESCAPE.")}>
          <Input mono value={current.key || ""} onChange={event => update({ key: event.target.value })} placeholder="ENTER or CONTROL + A" />
        </Field>
      )}

      {type === "wait" && (
        <Field label={t("Duration (milliseconds)")}>
          <Input type="number" min="0" max="300000" value={current.ms ?? 1000} onChange={event => update({ ms: Math.max(0, Math.min(300000, Number(event.target.value) || 0)) })} />
        </Field>
      )}

      {type === "scroll" && <Field label={t("Scroll distance (pixels)")}><Input type="number" value={current.scrollAmount ?? 600} onChange={event => update({ scrollAmount: Number(event.target.value) })} /></Field>}
      {type === "switchWindow" && <Field label={t("Tab index (zero-based)")}><Input type="number" min="0" value={current.ms ?? 0} onChange={event => update({ ms: Number(event.target.value) })} /></Field>}
      {type === "select" && <Field label={t("Option value")}><Input value={current.text || ""} onChange={event => update({ text: event.target.value })} /></Field>}
      {type === "saveText" && <Field label={t("Text content")}><Textarea value={current.text || ""} onChange={event => update({ text: event.target.value })} placeholder={t("Text to save into the workflow output ZIP")} /></Field>}

      {type === "dragDrop" && (
        <Field as="div" label={t("Destination locator")}>
          <div className="locator-row">
            <Select aria-label={t("Destination locator strategy")} value={current.target2?.strategy || "css"} onChange={event => update({ target2: { strategy: event.target.value as LocatorStrategy, value: current.target2?.value || "" } })}>
              {DEST_STRATEGIES.map(value => <option key={value} value={value}>{t(value)}</option>)}
            </Select>
            <Input mono aria-label={t("Destination locator")} value={current.target2?.value || ""} onChange={event => update({ target2: { strategy: current.target2?.strategy || "css", value: event.target.value } })} placeholder="#drop-target" />
          </div>
        </Field>
      )}

      {type === "uploadFile" && (
        <Block>
          <BlockHead icon={FolderOpen} caption={t("FILE UPLOAD")} title={t("Choose a local file")} text={t("FlowForge sends the file path to the page's file input.")} />
          <Field label={t("File path")} hint={t("Choose the file input as the target locator. The path stays on this computer until the workflow uploads it to the website.")}>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <Input mono value={current.filePath || ""} onChange={event => update({ filePath: event.target.value })} placeholder={String.raw`C:\Users\you\Documents\file.pdf`} />
              <Button icon={FolderOpen} iconAnim="pop" onClick={async () => {
                const result = await window.flowforge.chooseFile();
                if (result?.path) update({ filePath: result.path });
                else if (result?.error) setLogs(old => [...old, result.error!].slice(-300));
              }}>{t("Browse")}</Button>
            </div>
          </Field>
        </Block>
      )}

      {(type === "saveSession" || type === "loadSession") && (
        <Block>
          <div className="caption">{type === "saveSession" ? t("SAVE COOKIES & STORAGE") : t("RESTORE COOKIES & STORAGE")}</div>
          <p className="card-desc">{t("Session snapshots include cookies, localStorage, and sessionStorage for the current website origin. Choose a saved profile and a session name.")}</p>
          <Field label={t("Browser profile")}>
            <Select value={current.profileName || workflowProfileName || ""} onChange={event => { const name = event.target.value; update({ profileName: name }); void refreshSessions(name); }}>
              <option value="">{t("Use workflow profile")}</option>
              {profiles.map(profile => <option key={profile.name} value={profile.name}>{profile.name}</option>)}
            </Select>
          </Field>
          <Field as="div" label={t("Session name")} hint={type === "saveSession" ? t("Save after logging in or after the site has populated its storage. The snapshot is stored locally under the selected profile.") : t("Load after the browser starts. The engine navigates to the saved origin before restoring the snapshot. If the session is expired, log in again and save a fresh snapshot.")}>
            <>
              {type === "loadSession" && sessionNames.length > 0 && (
                <Select aria-label={t("Choose a saved session")} value={current.sessionName || ""} onChange={event => update({ sessionName: event.target.value })}>
                  <option value="">{t("Choose a saved session")}</option>
                  {sessionNames.map(name => <option key={name} value={name}>{name}</option>)}
                </Select>
              )}
              <Input value={current.sessionName || ""} onChange={event => update({ sessionName: event.target.value })} placeholder={type === "saveSession" ? t("e.g. logged-in-account") : t("Enter or select a saved session name")} />
            </>
          </Field>
          {type === "loadSession" && <Button size="sm" icon={RefreshCw} iconAnim="spin" onClick={() => void refreshSessions(sessionProfile)}>{t("Refresh saved sessions")}</Button>}
        </Block>
      )}

      {type === "userInput" && <Block><UserInputConfig app={app} current={current} /></Block>}

      {type === "runWorkflow" && (
        <Field label={t("Workflow to run")} hint={t("Runs the selected workflow inside the current browser session. Sub-workflows can call other workflows, with cycle and depth protection.")}>
          <Select value={current.workflowId || ""} onChange={event => update({ workflowId: event.target.value })}>
            <option value="">{t("Select a workflow…")}</option>
            {workflowLibrary.filter(item => item.id !== workflowId).map(item => <option key={item.id} value={item.id}>{item.document.name}</option>)}
          </Select>
        </Field>
      )}

      {["extractAttribute", "assertAttribute"].includes(type) && <Field label={t("Attribute name")}><Input mono value={current.attribute || "href"} onChange={event => update({ attribute: event.target.value })} placeholder="href, src, aria-label" /></Field>}

      {["assertText", "assertUrl", "assertTitle", "assertAttribute", "assertCount", "waitDownload"].includes(type) && (
        <Field label={type === "assertText" ? t("Expected text includes") : type === "waitDownload" ? t("Expected filename contains (optional)") : t("Expected value")}>
          <Input value={current.expected || ""} onChange={event => update({ expected: event.target.value })} placeholder={type === "assertCount" ? "0" : t("Expected text or value")} />
        </Field>
      )}

      {["extractText", "extractAttribute", "extractValue", "extractTable", "saveText", "saveImage", "screenshot", "saveSession"].includes(type) && (
        <Field label={t("Output name / variable")} hint={t("Extracted values become workflow variables and artifacts in this workflow's output ZIP.")}>
          <Input mono value={current.outputName || ""} onChange={event => update({ outputName: event.target.value })} placeholder="customer-name" />
        </Field>
      )}

      {type === "ifElse" && (
        <Block>
          <BlockHead icon={Braces} caption={t("LOGIC BLOCK")} title={t("If / else")} text={t("Branch on extracted text, URL changes, or whether an earlier action succeeded. For failed actions, set Error handling to Continue so the Else path can run.")} />
          <ConditionEditor app={app} />
          <div className="branch-stack">
            <NestedSteps app={app} field="thenSteps" label={t("If condition is true")} />
            <NestedSteps app={app} field="elseSteps" label={t("Otherwise")} />
          </div>
          <Hint icon={<Icon icon={CircleHelp} size={13} />}>
            <b>{t("True path:")}</b> {t("runs when the condition matches.")} <b>{t("Else path:")}</b> {t("runs otherwise.")} {t("For an earlier action, choose “Previous action result”, select that step ID, then use")} <code>{t("equals · success")}</code> / <code>{t("equals · error")}</code>. {t("To route a failed action into Else, set that action’s error handling to Continue.")}
          </Hint>
        </Block>
      )}

      {type === "while" && (
        <Block>
          <BlockHead icon={RefreshCw} caption={t("LOOP BLOCK")} title={t("Repeat while true")} text={t("Run actions until the condition no longer passes.")} />
          <ConditionEditor app={app} />
          <Field label={t("Maximum iterations (safety cap)")} hint={t("The condition is checked before each iteration. A safety cap prevents an endless loop.")}>
            <Input type="number" min="1" max="1000" value={current.repeatCount ?? 100} onChange={event => update({ repeatCount: Math.max(1, Math.min(1000, Number(event.target.value) || 100)) })} />
          </Field>
          <NestedSteps app={app} field="loopSteps" label={t("Loop body")} />
        </Block>
      )}

      {type === "repeat" && (
        <Block>
          <BlockHead icon={RefreshCw} caption={t("LOOP BLOCK")} title={t("Repeat N times")} text={t("Run a sequence a fixed number of times.")} />
          <Field label={t("Number of iterations (1 to 1,000)")} hint={t("Every action in the loop body runs in order for each iteration.")}>
            <Input type="number" min="1" max="1000" value={current.repeatCount ?? 2} onChange={event => update({ repeatCount: Math.max(1, Math.min(1000, Number(event.target.value) || 1)) })} />
          </Field>
          <NestedSteps app={app} field="loopSteps" label={t("Actions to repeat")} />
        </Block>
      )}

      {type === "loopList" && (
        <Block>
          <BlockHead icon={Layers} caption={t("ITERATION BLOCK")} title={t("For each item")} text={t("Run a sequence for every value in your list.")} />
          <div className="form-grid cols-2">
            <Field label={t("List values or JSON array")}><Input mono value={current.listExpression || ""} onChange={event => update({ listExpression: event.target.value })} placeholder={'alpha,beta,gamma or ["a","b"]'} /></Field>
            <Field label={t("Item variable name")} hint={t("The current value is exposed through the item variable while the loop body runs.")}><Input mono value={current.itemVariable || "item"} onChange={event => update({ itemVariable: event.target.value })} placeholder="item" /></Field>
          </div>
          <NestedSteps app={app} field="loopSteps" label={t("Actions for each item")} />
        </Block>
      )}

      {type === "regexReplace" && (
        <Block>
          <div className="caption">{t("REGEX VARIABLE TRANSFORM")}</div>
          <p className="card-desc">{t("Read a literal or existing variable, apply a regular expression, then store the transformed text in an output variable. Use ${variableName} to reference variables.")}</p>
          <Field label={t("Source text / variable expression")}><Input mono value={current.text || ""} onChange={event => update({ text: event.target.value })} placeholder="${email}" /></Field>
          <div className="form-grid cols-2">
            <Field label={t("Regex pattern")}><Input mono value={current.expected || ""} onChange={event => update({ expected: event.target.value })} placeholder="(\d{3})-(\d{4})" /></Field>
            <Field label={t("Replacement")}><Input mono value={current.attribute || ""} onChange={event => update({ attribute: event.target.value })} placeholder="$1/$2" /></Field>
            <Field label={t("Regex flags")} hint={t("Standard JavaScript RegExp flags: d, g, i, m, s, u, v, y.")}><Input mono value={current.key ?? "g"} onChange={event => update({ key: event.target.value })} placeholder="g, gi, gim" autoComplete="off" spellCheck={false} /></Field>
            <Field label={t("Output variable")}><Input mono value={current.outputName || "result"} onChange={event => update({ outputName: event.target.value })} placeholder="cleanedValue" /></Field>
          </div>
        </Block>
      )}

      {type === "setVariable" && (
        <Block>
          <div className="caption">{t("VARIABLES")}</div>
          <h3>{t("Set a variable")}</h3>
          <p className="card-desc">{t("Store text or a value built from existing variables. Use ${variableName} to reference another variable.")}</p>
          <Field label={t("Variable name")}><Input mono value={current.outputName || "result"} onChange={event => update({ outputName: event.target.value })} placeholder="customerName" /></Field>
          <Field label={t("Value")}><Textarea rows={3} value={current.text || ""} onChange={event => update({ text: event.target.value })} placeholder="${firstName} ${lastName}" /></Field>
        </Block>
      )}

      {type === "extractAll" && (
        <Block>
          <div className="caption">{t("COLLECT MATCHING ELEMENTS")}</div>
          <h3>{t("Select all matching elements")}</h3>
          <p className="card-desc">{t("Collect every matching element into a JSON array variable and a .json output artifact.")}</p>
          <div className="form-grid cols-2">
            <Field label={t("Extract")}>
              <Select value={current.bulkOperation || "extractText"} onChange={event => update({ bulkOperation: event.target.value as Step["bulkOperation"] })}>
                <option value="extractText">{t("Visible text")}</option>
                <option value="extractAttribute">{t("Attribute value")}</option>
                <option value="extractValue">{t("Input value")}</option>
              </Select>
            </Field>
            <Field label={t("Save array to variable")}><Input mono value={current.outputName || "result"} onChange={event => update({ outputName: event.target.value })} placeholder="items" /></Field>
          </div>
          {current.bulkOperation === "extractAttribute" && <Field label={t("Attribute name")}><Input mono value={current.attribute || "href"} onChange={event => update({ attribute: event.target.value })} /></Field>}
          <Hint>{t("Uses the locator above. Maximum 5,000 elements.")}</Hint>
        </Block>
      )}

      {type === "operateAll" && (
        <Block>
          <div className="caption">{t("BULK ACTION")}</div>
          <h3>{t("Operate on every match")}</h3>
          <p className="card-desc">{t("Apply one operation to all elements matched by the locator.")}</p>
          <Field label={t("Operation")}>
            <Select value={current.bulkOperation || "click"} onChange={event => update({ bulkOperation: event.target.value as Step["bulkOperation"] })}>
              <option value="click">{t("Click each match")}</option>
              <option value="type">{t("Type into each match")}</option>
              <option value="extractText">{t("Collect text into a variable")}</option>
              <option value="extractAttribute">{t("Collect attribute into a variable")}</option>
              <option value="extractValue">{t("Collect input values into a variable")}</option>
            </Select>
          </Field>
          {current.bulkOperation === "type" && <Field label={t("Text to type")}><Textarea rows={2} value={current.text || ""} onChange={event => update({ text: event.target.value })} /></Field>}
          {current.bulkOperation === "extractAttribute" && <Field label={t("Attribute name")}><Input mono value={current.attribute || "href"} onChange={event => update({ attribute: event.target.value })} /></Field>}
          {(current.bulkOperation || "click").startsWith("extract") && <Field label={t("Save results to variable")}><Input mono value={current.outputName || "result"} onChange={event => update({ outputName: event.target.value })} placeholder="results" /></Field>}
          <Hint>{t("Bulk click/type is limited to 1,000 elements. Test your selector with a small set first.")}</Hint>
        </Block>
      )}

      {type === "scrollTo" && <Hint>{t("Scrolls the selected element into the center of the viewport before continuing.")}</Hint>}
      {type === "waitDownload" && <Hint>{t("Downloads are routed to this workflow's output folder and included in the ZIP.")}</Hint>}
    </>
  );
}

const NO_SETTINGS = ["click", "hover", "rightClick", "doubleClick", "waitVisible", "waitClickable", "assertExists", "switchFrame", "back", "forward", "refresh", "closeTab", "alertAccept", "alertDismiss", "switchFrameDefault", "breakLoop", "continueLoop"];
/** True when the selected step has settings beyond the generic target/reliability sections. */
export const hasActionSettings = (type: string) => !NO_SETTINGS.includes(type);

export type { WorkflowStep };
