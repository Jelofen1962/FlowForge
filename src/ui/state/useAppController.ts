import { useEffect, useMemo, useRef, useState } from "react";
import {
  createId,
  createEmptyWorkflow,
  normalizeWorkflow,
  validateWorkflow,
  type WorkflowDocument,
  type WorkflowGroup,
  type WorkflowVariable,
  type UserInputField,
  type StepType,
  type LocatorStrategy,
  type OnErrorPolicy,
  type WorkflowStep
} from "../../core/workflow";
import { validateSessionSnapshot } from "../../core/session";
import { buildWorkflowPackage, importWorkflowPackage, type StoredWorkflow } from "../../core/workflowLibrary";
import { translate } from "../i18n/translations";
import { stepTypes } from "../data/actionCatalog";

export type Target = { strategy: LocatorStrategy; value: string };
export type Step = WorkflowStep & { target: Target };
export type OutputArchive = { name: string; path: string; size: number; modifiedAt: string; workflowName: string; runId: string; artifacts: Array<{ name: string; contentType: string; size: number; createdAt: string }> };
export type UserInputPrompt = { requestId: string; stepName: string; fields: Array<{ id: string; title: string; placeholder: string; required: boolean; secret: boolean; valueType?: "text" | "number" | "boolean" | "choice" | "regex"; pattern?: string; options?: string[]; variableName?: string }>; values: Record<string, string>; error?: string };
export type RunRecord = { id: string; workflow: string; startedAt: string; endedAt?: string; status: "running" | "success" | "failed" | "stopped" | "interrupted"; totalSteps: number; successfulSteps: number; failedSteps: number; skippedSteps: number; error?: string; durationMs?: number };

export const makeStep = (type: StepType = "click"): Step => ({
  id: crypto.randomUUID(),
  name: (stepTypes.find(([val]) => val === type)?.[1] || "New step"),
  type,
  target: { strategy: "css", value: "" },
  target2: type === "dragDrop" ? { strategy: "css", value: "" } : undefined,
  url: "https://example.com",
  text: "",
  key: "ENTER",
  ms: 1000,
  timeout: 10000,
  onError: "stop",
  clearFirst: true,
  attribute: ["extractAttribute", "assertAttribute"].includes(type) ? "href" : undefined,
  outputName: ["extractText", "extractAttribute", "extractValue", "extractTable", "saveText", "saveImage", "screenshot", "extractAll", "setVariable", "regexReplace"].includes(type) ? "result" : undefined,
  bulkOperation: type === "operateAll" ? "click" : undefined,
  scrollAmount: type === "scroll" ? 600 : undefined,
  repeatCount: type === "repeat" ? 2 : type === "while" ? 100 : undefined,
  listExpression: type === "loopList" ? "one,two,three" : undefined,
  itemVariable: type === "loopList" ? "item" : undefined,
  condition: ["ifElse", "while"].includes(type) ? { source: "lastText", operator: "contains", expected: "" } : undefined,
  thenSteps: type === "ifElse" ? [] : undefined,
  elseSteps: type === "ifElse" ? [] : undefined,
  loopSteps: ["repeat", "loopList", "while"].includes(type) ? [] : undefined,
  inputs: type === "userInput" ? [{ id: crypto.randomUUID(), title: "Value", placeholder: "Enter a value", required: true, secret: false, valueType: "text", target: { strategy: "css", value: "" } }] : undefined
});

const starter: Step[] = [
  { ...makeStep("navigate"), name: "Open website", url: "https://example.com" },
  { ...makeStep("waitVisible"), name: "Wait for heading", target: { strategy: "css", value: "h1" }, timeout: 10000 },
  { ...makeStep("click"), name: "Click target", target: { strategy: "xpath", value: "//button[normalize-space()='Continue']" } },
  { ...makeStep("type"), name: "Enter text", target: { strategy: "css", value: "input[name='email']" }, text: "hello@example.com" }
];

export function useAppController() {
  const [steps, setSteps] = useState<Step[]>(starter);
  const [workflowName, setWorkflowName] = useState("Untitled workflow");
  const [workflowId, setWorkflowId] = useState(() => createId());
  const [workflowLibrary, setWorkflowLibrary] = useState<StoredWorkflow[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [groups, setGroups] = useState<WorkflowGroup[]>([]);
  const [variables, setVariables] = useState<WorkflowVariable[]>([]);
  const [variableSearch, setVariableSearch] = useState("");
  const [selectedVariableId, setSelectedVariableId] = useState<string>("");
  const [saveState, setSaveState] = useState("Saved locally");
  const [selected, setSelected] = useState(starter[0].id);
  const [tab, setTab] = useState("workflow");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return localStorage.getItem("flowforge.theme.v1") === "light" ? "light" : "dark"; } catch { return "dark"; }
  });
  const [language, setLanguage] = useState<"en" | "fa">(() => {
    try { return localStorage.getItem("flowforge.language.v1") === "fa" ? "fa" : "en"; } catch { return "en"; }
  });
  const t = (text: string) => translate(language, text);
  const dateLocale = language === "fa" ? "fa-IR" : "en-US";
  const [commandOpen, setCommandOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("0.0.0");
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; currentVersion?: string; latestVersion?: string; releaseName?: string; notes?: string; url?: string; error?: string } | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [userInputPrompt, setUserInputPrompt] = useState<UserInputPrompt | null>(null);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const [browser, setBrowser] = useState("chrome");
  const [startUrl, setStartUrl] = useState("https://example.com");
  const [disableImages, setDisableImages] = useState(false);
  const [headless, setHeadless] = useState(false);
  const [disableCss, setDisableCss] = useState(false);
  const [disableFonts, setDisableFonts] = useState(false);
  const [disableMedia, setDisableMedia] = useState(false);
  const [pageLoadStrategy, setPageLoadStrategy] = useState("normal");
  const [closeBrowser, setCloseBrowser] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(() => {
    try { return localStorage.getItem("flowforge.schedule.enabled.v1") === "true"; } catch { return false; }
  });
  const [scheduleEvery, setScheduleEvery] = useState(() => {
    try { return Math.max(1, Number(localStorage.getItem("flowforge.schedule.every.v1")) || 5); } catch { return 5; }
  });
  const [scheduleUnit, setScheduleUnit] = useState(() => {
    try { return localStorage.getItem("flowforge.schedule.unit.v1") || "minutes"; } catch { return "minutes"; }
  });
  const [scheduleStartup, setScheduleStartup] = useState(() => {
    try { return localStorage.getItem("flowforge.schedule.startup.v1") === "true"; } catch { return false; }
  });
  const [profileName, setProfileName] = useState("Default profile");
  const [workflowProfileName, setWorkflowProfileName] = useState("");
  const [profiles, setProfiles] = useState<Array<{ name: string; browser?: "chrome" | "edge"; userDataDir?: string; optimizations?: Record<string, unknown> }>>([]);
  const [sessionNamesByProfile, setSessionNamesByProfile] = useState<Record<string, string[]>>({});
  const [userDataDir, setUserDataDir] = useState("");
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderLastScrollY = useRef(0);
  const [recordUrl, setRecordUrl] = useState("https://example.com");
  const [logs, setLogs] = useState<string[]>(["FlowForge engine ready.", "Create a workflow or run the sample steps."]);
  const [runState, setRunState] = useState<Record<string, string>>({});
  const [runHistory, setRunHistory] = useState<RunRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem("flowforge.runHistory.v1") || "[]").slice(0, 50); } catch { return []; }
  });
  const [outputArchives, setOutputArchives] = useState<OutputArchive[]>([]);
  const [outputRefreshToken, setOutputRefreshToken] = useState(0);
  const [outputPreview, setOutputPreview] = useState<{ archive: string; name: string; mime: string; data: string; text?: string } | null>(null);
  const [stepSearch, setStepSearch] = useState("");
  const activeRunId = useRef<string | null>(null);

  const current = steps.find(s => s.id === selected) || steps[0];
  const workflowDocument = useMemo(() => ({ version: 1 as const, name: workflowName, startUrl, browser: browser as "chrome" | "edge", profileName: workflowProfileName, steps, groups, variables }), [workflowName, startUrl, browser, workflowProfileName, steps, groups, variables]);
  const validation = useMemo(() => validateWorkflow(workflowDocument), [workflowDocument]);

  useEffect(() => { try { localStorage.setItem("flowforge.theme.v1", theme); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem("flowforge.language.v1", language); } catch {} }, [language]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-language", language);
  }, [language, theme]);

  useEffect(() => {
    let entries: StoredWorkflow[] = [];
    try {
      const rawLibrary = localStorage.getItem("flowforge.workflows.v1");
      if (rawLibrary) {
        const parsed = JSON.parse(rawLibrary);
        if (Array.isArray(parsed)) entries = parsed.map((item: any) => ({ id: typeof item.id === "string" && item.id ? item.id : createId(), document: normalizeWorkflow(item.document), updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(), aiTag: !!item.aiTag, aiProvenance: item.aiProvenance }));
      }
    } catch { entries = []; }
    if (!entries.length) {
      let initial: WorkflowDocument;
      try { const legacy = localStorage.getItem("flowforge.workflow.v1"); initial = legacy ? normalizeWorkflow(JSON.parse(legacy)) : { ...createEmptyWorkflow(), name: "Website smoke check", steps: starter as unknown as WorkflowDocument["steps"] }; }
      catch { initial = { ...createEmptyWorkflow(), name: "Website smoke check", steps: starter as unknown as WorkflowDocument["steps"] }; }
      const id = createId(); entries = [{ id, document: initial, updatedAt: new Date().toISOString() }];
    }
    const chosen = entries[0];
    setWorkflowLibrary(entries); setWorkflowId(chosen.id); setWorkflowName(chosen.document.name); setStartUrl(chosen.document.startUrl); setBrowser(chosen.document.browser); setWorkflowProfileName(chosen.document.profileName || ""); setSteps(chosen.document.steps as unknown as Step[]); setGroups(chosen.document.groups); setVariables(chosen.document.variables); setSelected(chosen.document.steps[0]?.id || ""); setLibraryReady(true);
  }, []);

  useEffect(() => {
    if (!libraryReady) return;
    setSaveState("Saving…");
    setWorkflowLibrary(all => {
      const index = all.findIndex(item => item.id === workflowId);
      const existing = index >= 0 ? all[index] : undefined;
      const updated: StoredWorkflow = { id: workflowId, document: workflowDocument, updatedAt: new Date().toISOString(), aiTag: existing?.aiTag, aiProvenance: existing?.aiProvenance };
      if (index < 0) return [...all, updated];
      const next = [...all]; next[index] = updated; return next;
    });
    try { localStorage.setItem("flowforge.workflow.v1", JSON.stringify(workflowDocument)); } catch {}
  }, [workflowDocument, workflowId, libraryReady]);

  useEffect(() => {
    if (libraryReady) {
      try { localStorage.setItem("flowforge.workflows.v1", JSON.stringify(workflowLibrary)); setSaveState("Saved locally"); } catch { setSaveState("Local save failed"); }
    }
  }, [workflowLibrary, libraryReady]);

  useEffect(() => { if (libraryReady) window.flowforge.syncAiWorkflows(workflowLibrary).catch(() => {}); }, [workflowLibrary, libraryReady]);
  useEffect(() => {
    if (tab !== "outputs" || !workflowId) return;
    let active = true;
    window.flowforge.listOutputs(workflowId).then(items => { if (active) setOutputArchives(items); }).catch(() => { if (active) setOutputArchives([]); });
    return () => { active = false; };
  }, [tab, workflowId, outputRefreshToken]);

  useEffect(() => { setOutputPreview(null); }, [workflowId]);

  useEffect(() => {
    const off = window.flowforge.onAiWorkflowUpsert(item => {
      try {
        const document = normalizeWorkflow(item.document);
        const val = validateWorkflow(document);
        if (!val.valid) { setLogs(old => [...old, `AI workflow validation failed: ${val.errors.join("; ")}`].slice(-300)); return; }
        const normalized: StoredWorkflow = { id: item.id, document, updatedAt: item.updatedAt || new Date().toISOString(), aiTag: true, aiProvenance: item.aiProvenance || "generated" };
        setWorkflowLibrary(all => {
          const index = all.findIndex(w => w.id === normalized.id);
          if (index < 0) return [...all, normalized];
          const next = [...all]; next[index] = normalized; return next;
        });
        setLogs(old => [...old, `AI workflow "${document.name}" was added to library.`].slice(-300));
      } catch (error) { setLogs(old => [...old, `Could not import AI workflow: ${error instanceof Error ? error.message : String(error)}`].slice(-300)); }
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.flowforge.onLog(line => {
      try {
        const p = JSON.parse(line);
        const safeLine = p.type === "session-export" ? JSON.stringify({ type: p.type, data: { origin: p.data?.origin, cookies: p.data?.cookies?.length || 0, localStorage: p.data?.localStorage?.length || 0, sessionStorage: p.data?.sessionStorage?.length || 0 } })
          : p.type === "performance" ? `Performance: total ${p.data.totalDurationMs} ms; navigation ${p.data.navigationDurationMs ?? "n/a"} ms; DOM ready ${p.data.domContentLoadedMs ?? "n/a"} ms; load ${p.data.loadEventMs ?? "n/a"} ms.`
          : p.type === "step" && p.data.durationMs !== undefined ? `${p.data.status}: step ${p.data.index + 1} (${p.data.name}) in ${p.data.durationMs} ms.`
          : line.trim();

        if (p.type === "user-input-request" && p.data && typeof p.data.requestId === "string" && Array.isArray(p.data.fields)) {
          setUserInputPrompt({ requestId: p.data.requestId, stepName: String(p.data.stepName || "User input"), fields: p.data.fields, values: Object.fromEntries(p.data.fields.map((field: { id: string }) => [field.id, ""])) });
          setLogs(old => [...old, `Waiting for user input: ${String(p.data.stepName || "User input")}.`].slice(-300));
        } else if (!(p.type === "recorder" && p.data?.status === "action")) {
          setLogs(old => [...old, safeLine].slice(-300));
        }

        if (p.type === "session-export" && p.data) {
          const json = JSON.stringify(p.data, null, 2); const blob = new Blob([json], { type: "application/json" }); const a = document.createElement("a"); const url = URL.createObjectURL(blob); a.href = url; a.download = `flowforge-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          setLogs(old => [...old, `Session snapshot exported for ${p.data.origin}.`].slice(-300));
        }
        if (p.type === "output-archive") { setOutputRefreshToken(v => v + 1); setLogs(old => [...old, `Output ZIP created: ${p.data?.name || "workflow output"}`].slice(-300)); }
        if (p.type === "session-import") setLogs(old => [...old, `Session import finished: ${p.data.cookies} cookies added.`].slice(-300));
        if (p.type === "step") {
          setRunState(s => ({ ...s, [steps[p.data.index]?.id]: p.data.status }));
          const runId = activeRunId.current;
          if (runId) setRunHistory(items => items.map(item => item.id !== runId ? item : { ...item, successfulSteps: item.successfulSteps + (p.data.status === "success" ? 1 : 0), failedSteps: item.failedSteps + (p.data.status === "error" ? 1 : 0), skippedSteps: item.skippedSteps + (p.data.status === "skipped" ? 1 : 0), error: p.data.status === "error" ? String(p.data.error || "Step failed") : item.error }));
        }
        if (p.type === "step-retry") setLogs(old => [...old, `Retrying step ${p.data.index + 1}: ${p.data.error}`].slice(-300));
        if (p.type === "done" && activeRunId.current) {
          const id = activeRunId.current; const endedAt = new Date().toISOString();
          setRunHistory(items => items.map(item => item.id !== id ? item : { ...item, endedAt, status: (p.data.stopped ? "stopped" : p.data.success && item.failedSteps === 0 ? "success" : "failed") as RunRecord["status"], durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(item.startedAt)) }));
          activeRunId.current = null;
        }
        if (p.type === "error") setUserInputPrompt(null);
        if (p.type === "error" && activeRunId.current) {
          const id = activeRunId.current; const endedAt = new Date().toISOString();
          setRunHistory(items => items.map(item => item.id !== id ? item : { ...item, endedAt, status: "failed" as RunRecord["status"], error: String(p.data?.message || "Engine error"), durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(item.startedAt)) }));
          activeRunId.current = null;
        }
        if (p.type === "recorder" && p.data?.status === "action" && p.data.action) {
          const ev = p.data.action;
          const target = ev.target;
          let actType: StepType | undefined;
          if (ev.action === "navigate") actType = "navigate";
          else if (ev.action === "click") actType = ev.button === "right" ? "rightClick" : "click";
          else if (ev.action === "rightClick") actType = "rightClick";
          else if (ev.action === "doubleClick") actType = "doubleClick";
          else if (ev.action === "hover") actType = "hover";
          else if (ev.action === "dragDrop") actType = "dragDrop";
          else if (ev.action === "type") actType = "type";
          else if (ev.action === "key") actType = "key";
          else if (ev.action === "select") actType = "select";
          else if (ev.action === "scroll") actType = "scroll";
          if (actType) {
            const step = makeStep(actType);
            const targetName = target?.id ? `#${target.id}` : target?.name ? `[name=${target.name}]` : target?.text ? `“${target.text.slice(0, 30)}”` : target?.tagName || "page";
            step.name = actType === "navigate" ? `Open ${ev.title || ev.url || "page"}` : actType === "type" ? `Type into ${targetName}` : `Click ${targetName}`;
            if (actType === "navigate") step.url = ev.url || recordUrl;
            if (target?.value && actType !== "navigate" && actType !== "scroll") step.target = { strategy: (target.strategy === "xpath" ? "xpath" : "css"), value: target.value };
            if (actType === "type") { step.text = ev.text || ""; step.clearFirst = true; }
            if (actType === "scroll") { const prior = recorderLastScrollY.current; step.scrollAmount = Math.max(-10000, Math.min(10000, (ev.y || 0) - prior)); recorderLastScrollY.current = ev.y || 0; }
            setSteps(all => [...all, step]); setSelected(step.id); setTab("workflow");
            setLogs(old => [...old, `Recorded: ${step.name}`].slice(-300));
          }
        }
        if (p.type === "recorder" && p.data?.status === "stopped") setRecording(false);
      } catch {}
    });
    const done = window.flowforge.onFinished(r => {
      setRunning(false); setRecording(false); setUserInputPrompt(null);
      setLogs(old => [...old, `Engine exited with code ${r.code}.`]);
      if (activeRunId.current) {
        const id = activeRunId.current; const endedAt = new Date().toISOString();
        setRunHistory(items => items.map(item => item.id !== id ? item : { ...item, endedAt, status: (r.stopped ? "stopped" : r.code === 0 ? "success" : "interrupted") as RunRecord["status"], durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(item.startedAt)) }));
        activeRunId.current = null;
      }
    });
    return () => { off(); done(); };
  }, [steps]);

  useEffect(() => { try { localStorage.setItem("flowforge.runHistory.v1", JSON.stringify(runHistory.slice(0, 50))); } catch {} }, [runHistory]);

  const update = (patch: Partial<Step>) => setSteps(all => all.map(s => s.id === selected ? { ...s, ...patch } : s));
  type NestedField = "thenSteps" | "elseSteps" | "loopSteps";
  const updateNested = (field: NestedField, next: WorkflowStep[]) => update({ [field]: next } as Partial<Step>);
  const addNested = (field: NestedField, type: StepType = "click") => { if (!current) return; const child = makeStep(type); updateNested(field, [...((current[field] || []) as WorkflowStep[]), child]); };
  const patchNested = (field: NestedField, id: string, patch: Partial<WorkflowStep>) => { if (!current) return; updateNested(field, ((current[field] || []) as WorkflowStep[]).map(s => s.id === id ? { ...s, ...patch } : s)); };
  const removeNested = (field: NestedField, id: string) => { if (!current) return; updateNested(field, ((current[field] || []) as WorkflowStep[]).filter(s => s.id !== id)); };

  const submitUserInput = async () => {
    if (!userInputPrompt) return;
    const missing = userInputPrompt.fields.find(f => f.required && !String(userInputPrompt.values[f.id] || "").trim());
    if (missing) { setUserInputPrompt(p => p ? { ...p, error: `${missing.title} is required.` } : p); return; }
    const result = await window.flowforge.respondUserInput({ requestId: userInputPrompt.requestId, values: userInputPrompt.values });
    if (!result.ok) { setUserInputPrompt(p => p ? { ...p, error: result.error || "Could not send input." } : p); return; }
    setUserInputPrompt(null);
  };
  const cancelUserInput = async () => { if (!userInputPrompt) return; await window.flowforge.respondUserInput({ requestId: userInputPrompt.requestId, cancel: true }); setUserInputPrompt(null); };

  const addStep = (type: StepType = "click") => { const s = makeStep(type); setSteps(all => [...all, s]); setSelected(s.id); setTab("workflow"); };
  const duplicateStep = () => { if (!current) return; const clone = { ...current, id: createId(), name: `${current.name} (copy)`, target: { ...current.target } }; const i = steps.findIndex(s => s.id === current.id); const next = [...steps]; next.splice(i + 1, 0, clone); setSteps(next); setSelected(clone.id); };
  const addGroup = () => { const group = { id: createId(), name: `Group ${groups.length + 1}`, collapsed: false }; setGroups(all => [...all, group]); };
  const addVariable = () => { const variable: WorkflowVariable = { id: createId(), name: `variable${variables.length + 1}`, value: "", secret: false, valueType: "text", scope: "workflow", description: "" }; setVariables(all => [...all, variable]); setSelectedVariableId(variable.id); setVariableSearch(""); };
  const updateVariable = (id: string, patch: Partial<WorkflowVariable>) => setVariables(all => all.map(v => v.id === id ? { ...v, ...patch } : v));
  const duplicateVariable = (v: WorkflowVariable) => { const copy = { ...v, id: createId(), name: `${v.name}_copy` }; setVariables(all => [...all, copy]); setSelectedVariableId(copy.id); };
  const variableNameError = (v: WorkflowVariable) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name) || variables.some(o => o.id !== v.id && o.name.trim() === v.name.trim());
  const deleteStep = (id: string) => { const next = steps.filter(x => x.id !== id); setSteps(next); if (selected === id) setSelected(next[0]?.id || ""); };
  const move = (dir: number) => { const i = steps.findIndex(s => s.id === selected), j = i + dir; if (j < 0 || j >= steps.length) return; const copy = [...steps]; [copy[i], copy[j]] = [copy[j], copy[i]]; setSteps(copy); };

  const run = async () => {
    if (running || steps.length === 0 || !validation.valid) return;
    setLogs([]); setRunState({}); setRunning(true);
    const startedAt = new Date().toISOString();
    const record: RunRecord = { id: createId(), workflow: workflowName, startedAt, status: "running", totalSteps: steps.length, successfulSteps: 0, failedSteps: 0, skippedSteps: 0 };
    activeRunId.current = record.id;
    setRunHistory(items => [record, ...items].slice(0, 50));
    const result = await window.flowforge.start({
      steps, startUrl, browser, variables, workflowName, currentWorkflowId: workflowId,
      profile: { name: workflowProfileName, browser: (profiles.find(p => p.name === workflowProfileName)?.browser || browser), userDataDir: profiles.find(p => p.name === workflowProfileName)?.userDataDir || undefined },
      optimizations: { disableImages, disableCss, disableFonts, disableMedia, pageLoadStrategy, headless },
      closeBrowserWhenDone: closeBrowser,
      workflowLibrary: Object.fromEntries(workflowLibrary.map(item => [item.id, item.id === workflowId ? workflowDocument : item.document]))
    });
    if (!result.ok) {
      setRunning(false); activeRunId.current = null;
      setRunHistory(items => items.map(item => item.id !== record.id ? item : { ...item, status: "failed", error: result.error || "Could not start engine." }));
      setLogs([result.error || "Could not start engine."]);
    }
  };

  const startRecorder = async () => {
    if (running) return;
    const first = makeStep("navigate"); first.name = "Open website"; first.url = recordUrl;
    const name = `Recorded workflow - ${new Date().toLocaleTimeString()}`;
    const doc: WorkflowDocument = { ...createEmptyWorkflow(), name, startUrl: "", browser: browser as "chrome" | "edge", steps: [first] as unknown as WorkflowDocument["steps"] };
    const item: StoredWorkflow = { id: createId(), document: doc, updatedAt: new Date().toISOString() };
    setWorkflowLibrary(all => [...all, item]); activateWorkflow(item); recorderLastScrollY.current = 0;
    const result = await window.flowforge.recorderStart({ startUrl: recordUrl, browser, profile: { name: profileName, browser, userDataDir: userDataDir || undefined } });
    if (result.ok) { setRecording(true); setRunning(true); setLogs([`Recorder started at ${recordUrl}. Edit captured steps in real-time.`]); }
    else setLogs(old => [...old, result.error || "Could not start recorder."]);
  };
  const stopRecorder = async () => { const result = await window.flowforge.recorderStop(); if (!result.ok) setLogs(old => [...old, result.error || "Could not stop recorder."]); };

  const refreshProfiles = async () => {
    try {
      const result = await window.flowforge.listProfiles(); setProfiles(result);
      for (const item of result) { if (!sessionNamesByProfile[item.name]) { const names = await window.flowforge.listSessions(item.name); setSessionNamesByProfile(old => ({ ...old, [item.name]: names })); } }
    } catch {}
  };
  useEffect(() => { void refreshProfiles(); }, []);
  const refreshSessions = async (name: string) => { if (!name) return; try { const names = await window.flowforge.listSessions(name); setSessionNamesByProfile(old => ({ ...old, [name]: names })); } catch {} };

  const saveProfile = async () => {
    const r = await window.flowforge.saveProfile({ name: profileName, browser, userDataDir, optimizations: { disableImages, disableCss, disableFonts, disableMedia, pageLoadStrategy, headless } });
    if (r.ok) { await refreshProfiles(); setWorkflowProfileName(profileName); }
    setLogs(old => [...old, `Profile saved: ${profileName}`]);
  };

  const exportSession = async () => { const r = await window.flowforge.sessionExport(); if (!r.ok) setLogs(old => [...old, r.error || "Could not export session."]); };
  const importSession = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      try {
        const snapshot = validateSessionSnapshot(JSON.parse(await f.text()));
        const r = await window.flowforge.sessionImport(snapshot);
        if (!r.ok) throw new Error(r.error || "No browser session running.");
        setLogs(old => [...old, `Session snapshot imported for ${snapshot.origin}.`]);
      } catch (e) { setLogs(old => [...old, `Session import rejected: ${e instanceof Error ? e.message : String(e)}`]); }
    };
    input.click();
  };

  const downloadJson = (value: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };
  const getWorkflowPackage = () => buildWorkflowPackage(workflowId, workflowLibrary, { id: workflowId, document: workflowDocument });
  const getWorkflowPackageFor = (rootId: string) => buildWorkflowPackage(rootId, workflowLibrary, { id: workflowId, document: workflowDocument });
  const exportWorkflow = () => downloadJson(getWorkflowPackage(), `${workflowName.replace(/[^a-z0-9-_]+/gi, "-") || "workflow"}.flowforge.json`);
  const exportWorkflowFor = (item: StoredWorkflow) => downloadJson(getWorkflowPackageFor(item.id), `${item.document.name.replace(/[^a-z0-9-_]+/gi, "-") || "workflow"}.flowforge.json`);

  const activateWorkflow = (item: StoredWorkflow) => {
    setWorkflowLibrary(all => all.map(existing => existing.id === workflowId ? { ...existing, document: workflowDocument, updatedAt: new Date().toISOString() } : existing));
    setWorkflowId(item.id); setWorkflowName(item.document.name); setSteps(item.document.steps as unknown as Step[]);
    setStartUrl(item.document.startUrl); setBrowser(item.document.browser); setWorkflowProfileName(item.document.profileName || "");
    setGroups(item.document.groups); setVariables(item.document.variables); setSelected(item.document.steps[0]?.id || "");
    setTab("workflow"); setSaveState("Saved locally");
  };

  const newWorkflow = () => {
    const doc: WorkflowDocument = { ...createEmptyWorkflow(), name: `Workflow ${workflowLibrary.length + 1}`, steps: [{ ...makeStep("navigate"), name: "Open website", url: "https://example.com" }] as unknown as WorkflowDocument["steps"] };
    const item = { id: createId(), document: doc, updatedAt: new Date().toISOString() };
    setWorkflowLibrary(all => [...all, item]); activateWorkflow(item); setCommandOpen(false); setCommandQuery("");
  };

  const duplicateWorkflow = (item: StoredWorkflow) => {
    const doc = normalizeWorkflow({ ...item.document, name: `${item.document.name} copy`, steps: item.document.steps.map(s => ({ ...s, id: createId() })) });
    const clone = { id: createId(), document: doc, updatedAt: new Date().toISOString() };
    setWorkflowLibrary(all => [...all, clone]); activateWorkflow(clone);
  };

  const deleteWorkflow = (id: string) => {
    if (workflowLibrary.length <= 1) return;
    const next = workflowLibrary.filter(item => item.id !== id);
    setWorkflowLibrary(next); if (workflowId === id) activateWorkflow(next[0]);
  };

  const importWorkflow = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      try {
        const imported = importWorkflowPackage(JSON.parse(await f.text()));
        setWorkflowLibrary(all => [...all, ...imported.workflows]);
        const root = imported.workflows.find(i => i.id === imported.rootWorkflowId) || imported.workflows[0];
        activateWorkflow(root);
      } catch (e) { setLogs(old => [...old, `Import rejected: ${e instanceof Error ? e.message : String(e)}`]); }
    };
    input.click();
  };

  const applyTemplate = (kind: "starter" | "form" | "search") => {
    const id = () => createId();
    const templates = {
      starter: { name: "Website smoke check", url: "https://example.com", steps: [{ ...makeStep("navigate"), id: id(), name: "Open website", url: "https://example.com" }, { ...makeStep("waitVisible"), id: id(), name: "Wait for heading", target: { strategy: "css" as const, value: "h1" } }, { ...makeStep("assertText"), id: id(), name: "Verify heading text", target: { strategy: "css" as const, value: "h1" }, expected: "Example Domain" }] },
      form: { name: "Form entry starter", url: "https://example.com", steps: [{ ...makeStep("navigate"), id: id(), name: "Open form", url: "https://example.com" }, { ...makeStep("waitVisible"), id: id(), name: "Wait for email field", target: { strategy: "css" as const, value: "input[name='email']" } }, { ...makeStep("type"), id: id(), name: "Enter email", target: { strategy: "css" as const, value: "input[name='email']" }, text: "name@example.com" }, { ...makeStep("click"), id: id(), name: "Submit form", target: { strategy: "css" as const, value: "button[type='submit']" } }] },
      search: { name: "Search page starter", url: "https://example.com", steps: [{ ...makeStep("navigate"), id: id(), name: "Open search", url: "https://example.com" }, { ...makeStep("waitVisible"), id: id(), name: "Wait for search box", target: { strategy: "css" as const, value: "input[type='search']" } }, { ...makeStep("type"), id: id(), name: "Enter query", target: { strategy: "css" as const, value: "input[type='search']" }, text: "Selenium automation" }, { ...makeStep("key"), id: id(), name: "Press Enter", target: { strategy: "css" as const, value: "input[type='search']" }, key: "ENTER" }] }
    };
    const tpl = templates[kind];
    setWorkflowName(tpl.name); setStartUrl(tpl.url); setSteps(tpl.steps as Step[]); setSelected(tpl.steps[0].id); setTab("workflow");
  };

  useEffect(() => { void window.flowforge.getVersion().then(v => { if (v) setAppVersion(v); }).catch(() => {}); }, []);
  const checkForUpdates = async (showStatus = false) => {
    setUpdateChecking(true); if (showStatus) setUpdateMessage("");
    try {
      const res = await window.flowforge.checkForUpdates();
      if (res.available) setUpdateInfo(res);
      else if (showStatus) setUpdateMessage(res.ok ? t("You are up to date.") : t("Could not check for updates."));
    } catch { if (showStatus) setUpdateMessage(t("Could not check for updates.")); }
    finally { setUpdateChecking(false); }
  };

  return {
    steps, setSteps, workflowName, setWorkflowName, workflowId, setWorkflowId,
    workflowLibrary, setWorkflowLibrary, libraryReady, groups, setGroups,
    variables, setVariables, variableSearch, setVariableSearch, selectedVariableId, setSelectedVariableId,
    saveState, selected, setSelected, tab, setTab, theme, setTheme, language, setLanguage,
    t, dateLocale, commandOpen, setCommandOpen, appVersion, updateInfo, setUpdateInfo,
    updateChecking, updateMessage, userInputPrompt, setUserInputPrompt, commandQuery, setCommandQuery,
    commandInputRef, browser, setBrowser, startUrl, setStartUrl, disableImages, setDisableImages,
    headless, setHeadless, disableCss, setDisableCss, disableFonts, setDisableFonts,
    disableMedia, setDisableMedia, pageLoadStrategy, setPageLoadStrategy, closeBrowser, setCloseBrowser,
    scheduleEnabled, setScheduleEnabled, scheduleEvery, setScheduleEvery, scheduleUnit, setScheduleUnit,
    scheduleStartup, setScheduleStartup, profileName, setProfileName, workflowProfileName, setWorkflowProfileName,
    profiles, sessionNamesByProfile, userDataDir, setUserDataDir, running, recording, recordUrl, setRecordUrl,
    logs, setLogs, runState, runHistory, setRunHistory, outputArchives, outputRefreshToken, setOutputRefreshToken,
    outputPreview, setOutputPreview, stepSearch, setStepSearch, current, workflowDocument, validation,
    update, updateNested, addNested, patchNested, removeNested, submitUserInput, cancelUserInput,
    addStep, duplicateStep, addGroup, addVariable, updateVariable, duplicateVariable, variableNameError,
    deleteStep, move, run, startRecorder, stopRecorder, refreshProfiles, refreshSessions, saveProfile,
    exportSession, importSession, exportWorkflow, exportWorkflowFor, activateWorkflow, newWorkflow,
    duplicateWorkflow, deleteWorkflow, importWorkflow, applyTemplate, checkForUpdates
  };
}

export type AppController = ReturnType<typeof useAppController>;
