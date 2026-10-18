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
  type WorkflowStep,
} from "../../core/workflow";
import { validateSessionSnapshot } from "../../core/session";
import { buildWorkflowPackage, importWorkflowPackage, type StoredWorkflow } from "../../core/workflowLibrary";
import { translate } from "../i18n/translations";
import { stepTypes } from "../data/actionCatalog";

export type Target = { strategy: LocatorStrategy; value: string };
export type Step = WorkflowStep & { target: Target };
export type OutputArchive = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  workflowName: string;
  runId: string;
  artifacts: Array<{ name: string; contentType: string; size: number; createdAt: string }>;
};
export type UserInputPrompt = {
  requestId: string;
  stepName: string;
  fields: Array<{
    id: string;
    title: string;
    placeholder: string;
    required: boolean;
    secret: boolean;
    valueType?: "text" | "number" | "boolean" | "choice" | "regex";
    pattern?: string;
    options?: string[];
    variableName?: string;
  }>;
  values: Record<string, string>;
  error?: string;
};
export type RunRecord = {
  id: string;
  workflow: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "success" | "failed" | "stopped" | "interrupted";
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  skippedSteps: number;
  error?: string;
  durationMs?: number;
};
export const makeStep = (type: StepType = "click"): Step => ({
  id: crypto.randomUUID(),
  name:
    (
      {
        navigate: "Navigate to URL",
        click: "Click element",
        type: "Type text",
        key: "Keyboard shortcut",
        hover: "Hover over element",
        rightClick: "Right-click element",
        doubleClick: "Double-click element",
        dragDrop: "Drag and drop",
        scrollTo: "Scroll to element",
        scroll: "Scroll page",
        waitVisible: "Wait until visible",
        waitClickable: "Wait until clickable",
        wait: "Wait / pause",
        waitDownload: "Wait for download",
        assertText: "Assert text",
        assertUrl: "Assert URL",
        assertExists: "Assert element exists",
        assertCount: "Assert element count",
        assertTitle: "Assert page title",
        assertAttribute: "Assert attribute",
        select: "Select option",
        uploadFile: "Upload file",
        extractText: "Extract element text",
        extractAttribute: "Extract attribute",
        extractValue: "Extract input value",
        extractTable: "Extract table to CSV",
        saveText: "Save text output",
        saveImage: "Save image from element",
        screenshot: "Take screenshot",
        saveSession: "Save browser session",
        alertAccept: "Accept browser alert",
        alertDismiss: "Dismiss browser alert",
        openTab: "Open new tab",
        closeTab: "Close current tab",
        switchWindow: "Switch browser tab",
        switchFrame: "Switch into frame",
        switchFrameDefault: "Return to main page from frame",
        ifElse: "If / else block",
        repeat: "Repeat steps",
        loopList: "Loop over list",
        while: "While condition is true",
        breakLoop: "Break loop",
        continueLoop: "Continue loop",
        setVariable: "Set variable",
        regexReplace: "Regex edit variable",
        extractAll: "Extract all matching elements",
        operateAll: "Operate on all matching elements",
        userInput: "Ask user for inputs",
        runWorkflow: "Run another workflow",
      } as Record<string, string>
    )[type] || "New step",
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
  outputName: [
    "extractText",
    "extractAttribute",
    "extractValue",
    "extractTable",
    "saveText",
    "saveImage",
    "screenshot",
    "extractAll",
    "setVariable",
    "regexReplace",
  ].includes(type)
    ? "result"
    : undefined,
  bulkOperation: type === "operateAll" ? "click" : undefined,
  scrollAmount: type === "scroll" ? 600 : undefined,
  repeatCount: type === "repeat" ? 2 : type === "while" ? 100 : undefined,
  listExpression: type === "loopList" ? "one,two,three" : undefined,
  itemVariable: type === "loopList" ? "item" : undefined,
  condition: ["ifElse", "while"].includes(type)
    ? { source: "lastText", operator: "contains", expected: "" }
    : undefined,
  thenSteps: type === "ifElse" ? [] : undefined,
  elseSteps: type === "ifElse" ? [] : undefined,
  loopSteps: ["repeat", "loopList", "while"].includes(type) ? [] : undefined,
  inputs:
    type === "userInput"
      ? [
          {
            id: crypto.randomUUID(),
            title: "Value",
            placeholder: "Enter a value",
            required: true,
            secret: false,
            valueType: "text",
            target: { strategy: "css", value: "" },
          },
        ]
      : undefined,
});
const starter: Step[] = [
  { ...makeStep("navigate"), name: "Open website", url: "https://example.com" },
  {
    ...makeStep("waitVisible"),
    name: "Wait for heading",
    target: { strategy: "css", value: "h1" },
    timeout: 10000,
  },
  {
    ...makeStep("click"),
    name: "Click target",
    target: { strategy: "xpath", value: "//button[normalize-space()='Continue']" },
  },
  {
    ...makeStep("type"),
    name: "Enter text",
    target: { strategy: "css", value: "input[name='email']" },
    text: "hello@example.com",
  },
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
    try {
      return localStorage.getItem("flowforge.theme.v1") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [language, setLanguage] = useState<"en" | "fa">(() => {
    try {
      return localStorage.getItem("flowforge.language.v1") === "fa" ? "fa" : "en";
    } catch {
      return "en";
    }
  });
  const t = (text: string) => translate(language, text);
  const dateLocale = language === "fa" ? "fa-IR" : "en-US";
  const [commandOpen, setCommandOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("0.0.0");
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean;
    currentVersion?: string;
    latestVersion?: string;
    releaseName?: string;
    notes?: string;
    url?: string;
    error?: string;
  } | null>(null);
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
    try {
      return localStorage.getItem("flowforge.schedule.enabled.v1") === "true";
    } catch {
      return false;
    }
  });
  const [scheduleEvery, setScheduleEvery] = useState(() => {
    try {
      return Math.max(1, Number(localStorage.getItem("flowforge.schedule.every.v1")) || 5);
    } catch {
      return 5;
    }
  });
  const [scheduleUnit, setScheduleUnit] = useState(() => {
    try {
      return localStorage.getItem("flowforge.schedule.unit.v1") || "minutes";
    } catch {
      return "minutes";
    }
  });
  const [scheduleStartup, setScheduleStartup] = useState(() => {
    try {
      return localStorage.getItem("flowforge.schedule.startup.v1") === "true";
    } catch {
      return false;
    }
  });
  const [profileName, setProfileName] = useState("Default profile");
  const [workflowProfileName, setWorkflowProfileName] = useState("");
  const [profiles, setProfiles] = useState<
    Array<{
      name: string;
      browser?: "chrome" | "edge";
      userDataDir?: string;
      optimizations?: Record<string, unknown>;
    }>
  >([]);
  const [sessionNamesByProfile, setSessionNamesByProfile] = useState<Record<string, string[]>>({});
  const [userDataDir, setUserDataDir] = useState("");
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderLastScrollY = useRef(0);
  const [recordUrl, setRecordUrl] = useState("https://example.com");
  const [logs, setLogs] = useState<string[]>([
    "FlowForge engine ready.",
    "Create a workflow or run the sample steps.",
  ]);
  const [runState, setRunState] = useState<Record<string, string>>({});
  const [runHistory, setRunHistory] = useState<RunRecord[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("flowforge.runHistory.v1") || "[]").slice(0, 50);
    } catch {
      return [];
    }
  });
  const [outputArchives, setOutputArchives] = useState<OutputArchive[]>([]);
  const [outputRefreshToken, setOutputRefreshToken] = useState(0);
  const [outputPreview, setOutputPreview] = useState<{
    archive: string;
    name: string;
    mime: string;
    data: string;
    text?: string;
  } | null>(null);
  const [stepSearch, setStepSearch] = useState("");
  const activeRunId = useRef<string | null>(null);
  const current = steps.find((s) => s.id === selected) || steps[0];
  const workflowDocument = useMemo(
    () => ({
      version: 1 as const,
      name: workflowName,
      startUrl,
      browser: browser as "chrome" | "edge",
      profileName: workflowProfileName,
      steps,
      groups,
      variables,
    }),
    [workflowName, startUrl, browser, workflowProfileName, steps, groups, variables],
  );
  const validation = useMemo(() => validateWorkflow(workflowDocument), [workflowDocument]);
  useEffect(() => {
    try {
      localStorage.setItem("flowforge.theme.v1", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem("flowforge.language.v1", language);
    } catch {}
  }, [language]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);
  useEffect(() => {
    let entries: StoredWorkflow[] = [];
    try {
      const rawLibrary = localStorage.getItem("flowforge.workflows.v1");
      if (rawLibrary) {
        const parsed = JSON.parse(rawLibrary);
        if (Array.isArray(parsed))
          entries = parsed.map((item: any) => ({
            id: typeof item.id === "string" && item.id ? item.id : createId(),
            document: normalizeWorkflow(item.document),
            updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
            aiTag: !!item.aiTag,
            aiProvenance: item.aiProvenance,
          }));
      }
    } catch {
      entries = [];
    }
    if (!entries.length) {
      let initial: WorkflowDocument;
      try {
        const legacy = localStorage.getItem("flowforge.workflow.v1");
        initial = legacy
          ? normalizeWorkflow(JSON.parse(legacy))
          : {
              ...createEmptyWorkflow(),
              name: "Website smoke check",
              steps: starter as unknown as WorkflowDocument["steps"],
            };
      } catch {
        initial = {
          ...createEmptyWorkflow(),
          name: "Website smoke check",
          steps: starter as unknown as WorkflowDocument["steps"],
        };
      }
      const id = createId();
      entries = [{ id, document: initial, updatedAt: new Date().toISOString() }];
    }
    const chosen = entries[0];
    setWorkflowLibrary(entries);
    setWorkflowId(chosen.id);
    setWorkflowName(chosen.document.name);
    setStartUrl(chosen.document.startUrl);
    setBrowser(chosen.document.browser);
    setWorkflowProfileName(chosen.document.profileName || "");
    setSteps(chosen.document.steps as unknown as Step[]);
    setGroups(chosen.document.groups);
    setVariables(chosen.document.variables);
    setSelected(chosen.document.steps[0]?.id || "");
    setLibraryReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!libraryReady) return;
    setSaveState("Saving…");
    setWorkflowLibrary((all) => {
      const index = all.findIndex((item) => item.id === workflowId);
      const existing = index >= 0 ? all[index] : undefined;
      const updated: StoredWorkflow = {
        id: workflowId,
        document: workflowDocument,
        updatedAt: new Date().toISOString(),
        aiTag: existing?.aiTag,
        aiProvenance: existing?.aiProvenance,
      };
      if (index < 0) return [...all, updated];
      const next = [...all];
      next[index] = updated;
      return next;
    });
    try {
      localStorage.setItem("flowforge.workflow.v1", JSON.stringify(workflowDocument));
    } catch {}
  }, [workflowDocument, workflowId, libraryReady]);
  useEffect(() => {
    if (libraryReady) {
      try {
        localStorage.setItem("flowforge.workflows.v1", JSON.stringify(workflowLibrary));
        setSaveState("Saved locally");
      } catch {
        setSaveState("Local save failed");
      }
    }
  }, [workflowLibrary, libraryReady]);
  useEffect(() => {
    if (libraryReady) window.flowforge.syncAiWorkflows(workflowLibrary).catch(() => {});
  }, [workflowLibrary, libraryReady]);
  useEffect(() => {
    if (tab !== "outputs" || !workflowId) return;
    let active = true;
    window.flowforge
      .listOutputs(workflowId)
      .then((items) => {
        if (active) setOutputArchives(items);
      })
      .catch(() => {
        if (active) setOutputArchives([]);
      });
    return () => {
      active = false;
    };
  }, [tab, workflowId, outputRefreshToken]);
  useEffect(() => {
    setOutputPreview(null);
  }, [workflowId]);
  useEffect(() => {
    const off = window.flowforge.onAiWorkflowUpsert((item) => {
      try {
        const document = normalizeWorkflow(item.document);
        const validation = validateWorkflow(document);
        if (!validation.valid) {
          setLogs((old) =>
            [
              ...old,
              `AI workflow was not imported because validation failed: ${validation.errors.join("; ")}`,
            ].slice(-300),
          );
          return;
        }
        const normalized: StoredWorkflow = {
          id: item.id,
          document,
          updatedAt: item.updatedAt || new Date().toISOString(),
          aiTag: true,
          aiProvenance: item.aiProvenance || "generated",
        };
        setWorkflowLibrary((all) => {
          const index = all.findIndex((w) => w.id === normalized.id);
          if (index < 0) return [...all, normalized];
          const next = [...all];
          next[index] = normalized;
          return next;
        });
        setLogs((old) =>
          [...old, `AI workflow "${document.name}" was added to the local library for review.`].slice(-300),
        );
      } catch (error) {
        setLogs((old) =>
          [
            ...old,
            `Could not import AI workflow: ${error instanceof Error ? error.message : String(error)}`,
          ].slice(-300),
        );
      }
    });
    return off;
  }, []);
  useEffect(() => {
    const off = window.flowforge.onLog((line) => {
      try {
        const p = JSON.parse(line);
        const safeLine =
          p.type === "session-export"
            ? JSON.stringify({
                type: p.type,
                data: {
                  origin: p.data?.origin,
                  cookies: p.data?.cookies?.length || 0,
                  localStorage: p.data?.localStorage?.length || 0,
                  sessionStorage: p.data?.sessionStorage?.length || 0,
                },
              })
            : p.type === "performance"
              ? `Performance: total ${p.data.totalDurationMs} ms; navigation ${p.data.navigationDurationMs ?? "n/a"} ms; DOM ready ${p.data.domContentLoadedMs ?? "n/a"} ms; load ${p.data.loadEventMs ?? "n/a"} ms; ${p.data.resourceCount ?? "n/a"} resources; ${p.data.transferBytes ?? "n/a"} transfer bytes.`
              : p.type === "step" && p.data.durationMs !== undefined
                ? `${p.data.status}: step ${p.data.index + 1} (${p.data.name}) in ${p.data.durationMs} ms${p.data.attempts > 1 ? ` after ${p.data.attempts} attempts` : ""}.`
                : line.trim();
        if (
          p.type === "user-input-request" &&
          p.data &&
          typeof p.data.requestId === "string" &&
          Array.isArray(p.data.fields)
        ) {
          setUserInputPrompt({
            requestId: p.data.requestId,
            stepName: String(p.data.stepName || "User input"),
            fields: p.data.fields,
            values: Object.fromEntries(p.data.fields.map((field: { id: string }) => [field.id, ""])),
          });
          setLogs((old) =>
            [...old, `Waiting for user input: ${String(p.data.stepName || "User input")}.`].slice(-300),
          );
        } else if (!(p.type === "recorder" && p.data?.status === "action")) {
          setLogs((old) => [...old, safeLine].slice(-300));
        }
        if (p.type === "session-export" && p.data) {
          const json = JSON.stringify(p.data, null, 2);
          const blob = new Blob([json], { type: "application/json" });
          const a = document.createElement("a");
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = `flowforge-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
          a.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          setLogs((old) =>
            [
              ...old,
              `Session snapshot exported for ${p.data.origin}. Treat the file as a password-equivalent secret.`,
            ].slice(-300),
          );
        }
        if (p.type === "output-archive") {
          setOutputRefreshToken((value) => value + 1);
          setLogs((old) => [...old, `Output ZIP created: ${p.data?.name || "workflow output"}`].slice(-300));
        }
        if (p.type === "session-import")
          setLogs((old) =>
            [
              ...old,
              `Session import finished: ${p.data.cookies} cookies added, ${p.data.expired} expired skipped, ${p.data.rejected} rejected, ${p.data.storageEntries} storage entries restored.`,
            ].slice(-300),
          );
        if (p.type === "step") {
          setRunState((s) => ({ ...s, [steps[p.data.index]?.id]: p.data.status }));
          const runId = activeRunId.current;
          if (runId)
            setRunHistory((items) =>
              items.map((item) =>
                item.id !== runId
                  ? item
                  : {
                      ...item,
                      successfulSteps: item.successfulSteps + (p.data.status === "success" ? 1 : 0),
                      failedSteps: item.failedSteps + (p.data.status === "error" ? 1 : 0),
                      skippedSteps: item.skippedSteps + (p.data.status === "skipped" ? 1 : 0),
                      error: p.data.status === "error" ? String(p.data.error || "Step failed") : item.error,
                    },
              ),
            );
        }
        if (p.type === "step-retry")
          setLogs((old) =>
            [
              ...old,
              `Retrying step ${p.data.index + 1} (${p.data.nextAttempt}/${p.data.maxAttempts}): ${p.data.error}`,
            ].slice(-300),
          );
        if (p.type === "done" && activeRunId.current) {
          const id = activeRunId.current;
          const endedAt = new Date().toISOString();
          setRunHistory((items) =>
            items.map((item) =>
              item.id !== id
                ? item
                : {
                    ...item,
                    endedAt,
                    status: (p.data.stopped
                      ? "stopped"
                      : p.data.success && item.failedSteps === 0
                        ? "success"
                        : "failed") as RunRecord["status"],
                    durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(item.startedAt)),
                  },
            ),
          );
          activeRunId.current = null;
        }
        if (p.type === "error") setUserInputPrompt(null);
        if (p.type === "error" && activeRunId.current) {
          const id = activeRunId.current;
          const endedAt = new Date().toISOString();
          setRunHistory((items) =>
            items.map((item) =>
              item.id !== id
                ? item
                : {
                    ...item,
                    endedAt,
                    status: "failed" as RunRecord["status"],
                    error: String(p.data?.message || "Engine error"),
                    durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(item.startedAt)),
                  },
            ),
          );
          activeRunId.current = null;
        }
        if (p.type === "recorder" && p.data?.status === "action" && p.data.action) {
          const event = p.data.action as {
            action?: string;
            url?: string;
            title?: string;
            target?: {
              strategy?: string;
              value?: string;
              tagName?: string;
              id?: string;
              name?: string;
              text?: string;
            };
            target2?: { strategy?: string; value?: string };
            text?: string;
            key?: string;
            value?: string;
            selectedText?: string;
            checked?: boolean;
            y?: number;
            x?: number;
            button?: string;
            at?: number;
          };
          const target = event.target;
          let type: StepType | undefined;
          if (event.action === "navigate") type = "navigate";
          else if (event.action === "click") type = event.button === "right" ? "rightClick" : "click";
          else if (event.action === "rightClick") type = "rightClick";
          else if (event.action === "doubleClick") type = "doubleClick";
          else if (event.action === "hover") type = "hover";
          else if (event.action === "dragDrop") type = "dragDrop";
          else if (event.action === "type") type = "type";
          else if (event.action === "key") type = "key";
          else if (event.action === "select") type = "select";
          else if (event.action === "check") type = "click";
          else if (event.action === "scroll") type = "scroll";
          if (type) {
            const step = makeStep(type);
            const targetName = target?.id
              ? `#${target.id}`
              : target?.name
                ? `[name=${target.name}]`
                : target?.text
                  ? `“${target.text.slice(0, 36)}”`
                  : target?.tagName || "page";
            step.name =
              type === "navigate"
                ? `Open ${event.title || event.url || "page"}`
                : type === "type"
                  ? `Enter text in ${targetName}`
                  : type === "select"
                    ? `Select option in ${targetName}`
                    : type === "key"
                      ? `Press ${event.key || "key"}`
                      : type === "scroll"
                        ? "Scroll page"
                        : type === "doubleClick"
                          ? `Double-click ${targetName}`
                          : type === "rightClick"
                            ? `Right-click ${targetName}`
                            : `Click ${targetName}`;
            if (type === "navigate") step.url = event.url || recordUrl;
            if (target?.value && type !== "navigate" && type !== "scroll")
              step.target = { strategy: target.strategy === "xpath" ? "xpath" : "css", value: target.value };
            if (type === "dragDrop" && event.target2?.value)
              step.target2 = {
                strategy: event.target2.strategy === "xpath" ? "xpath" : "css",
                value: event.target2.value,
              };
            if (type === "type") {
              step.text = event.text || "";
              step.clearFirst = true;
            }
            if (type === "key") step.key = event.key || "ENTER";
            if (type === "select") step.text = event.value || event.selectedText || "";
            if (type === "scroll") {
              const prior = recorderLastScrollY.current;
              step.scrollAmount = Math.max(-10000, Math.min(10000, (event.y || 0) - prior));
              recorderLastScrollY.current = event.y || 0;
            }
            setSteps((all) => [...all, step]);
            setSelected(step.id);
            setTab("workflow");
            setLogs((old) =>
              [
                ...old,
                `Recorded ${step.name}${type === "type" ? ` (${(event.text || "").length} characters)` : ""}. You can edit this step in the workflow editor.`,
              ].slice(-300),
            );
          }
        }
        if (p.type === "recorder" && p.data?.status === "stopped") setRecording(false);
      } catch {}
    });
    const done = window.flowforge.onFinished((r) => {
      setRunning(false);
      setRecording(false);
      setUserInputPrompt(null);
      setLogs((old) => [...old, `Engine exited (${r.code}).`]);
      if (activeRunId.current) {
        const id = activeRunId.current;
        const endedAt = new Date().toISOString();
        setRunHistory((items) =>
          items.map((item) =>
            item.id !== id
              ? item
              : {
                  ...item,
                  endedAt,
                  status: (r.stopped
                    ? "stopped"
                    : r.code === 0
                      ? "success"
                      : "interrupted") as RunRecord["status"],
                  error: r.code === 0 ? item.error : `Runner exited with code ${r.code}`,
                  durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(item.startedAt)),
                },
          ),
        );
        activeRunId.current = null;
      }
    });
    return () => {
      off();
      done();
    };
  }, [steps]);
  useEffect(() => {
    try {
      localStorage.setItem("flowforge.runHistory.v1", JSON.stringify(runHistory.slice(0, 50)));
    } catch {}
  }, [runHistory]);
  const update = (patch: Partial<Step>) =>
    setSteps((all) => all.map((s) => (s.id === selected ? { ...s, ...patch } : s)));
  type NestedField = "thenSteps" | "elseSteps" | "loopSteps";
  const updateNested = (field: NestedField, next: WorkflowStep[]) =>
    update({ [field]: next } as Partial<Step>);
  const addNested = (field: NestedField, type: StepType = "click") => {
    if (!current) return;
    const child = makeStep(type);
    updateNested(field, [...((current[field] || []) as WorkflowStep[]), child]);
  };
  const patchNested = (field: NestedField, id: string, patch: Partial<WorkflowStep>) => {
    if (!current) return;
    updateNested(
      field,
      ((current[field] || []) as WorkflowStep[]).map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    );
  };
  const removeNested = (field: NestedField, id: string) => {
    if (!current) return;
    updateNested(
      field,
      ((current[field] || []) as WorkflowStep[]).filter((step) => step.id !== id),
    );
  };
  const submitUserInput = async () => {
    if (!userInputPrompt) return;
    const missing = userInputPrompt.fields.find(
      (field) => field.required && !String(userInputPrompt.values[field.id] || "").trim(),
    );
    if (missing) {
      setUserInputPrompt((prompt) =>
        prompt ? { ...prompt, error: `${missing.title} is required.` } : prompt,
      );
      return;
    }
    const invalid = userInputPrompt.fields.find((field) => {
      const value = String(userInputPrompt.values[field.id] || "");
      if (!value && !field.required) return false;
      if (field.valueType === "number" && !Number.isFinite(Number(value))) return true;
      if (field.valueType === "boolean" && !["true", "false"].includes(value.trim().toLowerCase()))
        return true;
      if (field.valueType === "choice" && field.options?.length && !field.options.includes(value))
        return true;
      if (field.pattern) {
        try {
          return !new RegExp(field.pattern).test(value);
        } catch {
          return true;
        }
      }
      return false;
    });
    if (invalid) {
      setUserInputPrompt((prompt) =>
        prompt
          ? { ...prompt, error: `${invalid.title} has an invalid value. Check its type or regex pattern.` }
          : prompt,
      );
      return;
    }
    const result = await window.flowforge.respondUserInput({
      requestId: userInputPrompt.requestId,
      values: userInputPrompt.values,
    });
    if (!result.ok) {
      setUserInputPrompt((prompt) =>
        prompt ? { ...prompt, error: result.error || "Could not send input." } : prompt,
      );
      return;
    }
    setUserInputPrompt(null);
  };
  const cancelUserInput = async () => {
    if (!userInputPrompt) return;
    await window.flowforge.respondUserInput({ requestId: userInputPrompt.requestId, cancel: true });
    setUserInputPrompt(null);
  };
  const addStep = (type: StepType = "click") => {
    const s = makeStep(type);
    setSteps((all) => [...all, s]);
    setSelected(s.id);
    setTab("workflow");
  };
  const duplicateStep = () => {
    if (!current) return;
    const clone = { ...current, id: createId(), name: `${current.name} copy`, target: { ...current.target } };
    const i = steps.findIndex((s) => s.id === current.id);
    const next = [...steps];
    next.splice(i + 1, 0, clone);
    setSteps(next);
    setSelected(clone.id);
  };
  const addGroup = () => {
    const group = { id: createId(), name: `Group ${groups.length + 1}`, collapsed: false };
    setGroups((all) => [...all, group]);
    setLogs((old) => [...old, `Created ${group.name}.`]);
  };
  const addVariable = () => {
    const variable: WorkflowVariable = {
      id: createId(),
      name: `variable${variables.length + 1}`,
      value: "",
      secret: false,
      valueType: "text",
      scope: "workflow",
      description: "",
    };
    setVariables((all) => [...all, variable]);
    setSelectedVariableId(variable.id);
    setVariableSearch("");
  };
  const updateVariable = (id: string, patch: Partial<WorkflowVariable>) =>
    setVariables((all) => all.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const duplicateVariable = (variable: WorkflowVariable) => {
    const copy: WorkflowVariable = { ...variable, id: createId(), name: `${variable.name}_copy` };
    setVariables((all) => [...all, copy]);
    setSelectedVariableId(copy.id);
  };
  const variableNameError = (variable: WorkflowVariable) =>
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name) ||
    variables.some((other) => other.id !== variable.id && other.name.trim() === variable.name.trim());
  const deleteStep = (id: string) => {
    const next = steps.filter((x) => x.id !== id);
    setSteps(next);
    if (selected === id) setSelected(next[0]?.id || "");
  };
  const move = (direction: number) => {
    const i = steps.findIndex((s) => s.id === selected),
      j = i + direction;
    if (j < 0 || j >= steps.length) return;
    const copy = [...steps];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setSteps(copy);
  };
  const run = async () => {
    if (running) {
      setLogs((old) => [...old, "Scheduled run skipped because a workflow is already running."]);
      return;
    }
    if (steps.length === 0) {
      setLogs(["Add at least one step before running the workflow."]);
      return;
    }
    if (!validation.valid) {
      setLogs(["Workflow validation failed:", ...validation.errors]);
      return;
    }
    setLogs([]);
    setRunState({});
    setRunning(true);
    const startedAt = new Date().toISOString();
    const record: RunRecord = {
      id: createId(),
      workflow: workflowName,
      startedAt,
      status: "running",
      totalSteps: steps.length,
      successfulSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
    };
    activeRunId.current = record.id;
    setRunHistory((items) => [record, ...items].slice(0, 50));
    const result = await window.flowforge.start({
      steps,
      startUrl,
      browser,
      variables,
      workflowName,
      currentWorkflowId: workflowId,
      profile: {
        name: workflowProfileName,
        browser: profiles.find((p) => p.name === workflowProfileName)?.browser || browser,
        userDataDir: profiles.find((p) => p.name === workflowProfileName)?.userDataDir || undefined,
      },
      optimizations: { disableImages, disableCss, disableFonts, disableMedia, pageLoadStrategy, headless },
      closeBrowserWhenDone: closeBrowser,
      workflowLibrary: Object.fromEntries(
        workflowLibrary.map((item) => [item.id, item.id === workflowId ? workflowDocument : item.document]),
      ),
    });
    if (!result.ok) {
      setRunning(false);
      activeRunId.current = null;
      const endedAt = new Date().toISOString();
      setRunHistory((items) =>
        items.map((item) =>
          item.id !== record.id
            ? item
            : {
                ...item,
                endedAt,
                status: "failed" as RunRecord["status"],
                error: result.error || "Could not start engine.",
                durationMs: Date.parse(endedAt) - Date.parse(startedAt),
              },
        ),
      );
      setLogs([result.error || "Could not start engine."]);
    }
  };
  const scheduledRunRef = useRef<() => Promise<void>>(async () => {});
  scheduledRunRef.current = run;
  useEffect(() => {
    try {
      localStorage.setItem("flowforge.schedule.enabled.v1", String(scheduleEnabled));
      localStorage.setItem("flowforge.schedule.every.v1", String(scheduleEvery));
      localStorage.setItem("flowforge.schedule.unit.v1", scheduleUnit);
      localStorage.setItem("flowforge.schedule.startup.v1", String(scheduleStartup));
    } catch {}
  }, [scheduleEnabled, scheduleEvery, scheduleUnit, scheduleStartup]);
  useEffect(() => {
    if (!scheduleEnabled) return;
    const factor =
      scheduleUnit === "seconds"
        ? 1000
        : scheduleUnit === "hours"
          ? 3600000
          : scheduleUnit === "days"
            ? 86400000
            : 60000;
    const ms = Math.min(2147483647, Math.max(1000, scheduleEvery * factor));
    const timer = window.setInterval(() => {
      void scheduledRunRef.current();
    }, ms);
    return () => window.clearInterval(timer);
  }, [scheduleEnabled, scheduleEvery, scheduleUnit]);
  useEffect(() => {
    if (!scheduleStartup || !libraryReady) return;
    const marker = `flowforge.startup-ran.${workflowId}`;
    try {
      if (sessionStorage.getItem(marker) === "true") return;
      sessionStorage.setItem(marker, "true");
    } catch {}
    const timer = window.setTimeout(() => {
      void scheduledRunRef.current();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [scheduleStartup, libraryReady]);
  const startRecorder = async () => {
    if (running) return;
    const first = makeStep("navigate");
    first.name = "Open website";
    first.url = recordUrl;
    const name = `Recorded workflow - ${new Date().toLocaleString()}`;
    const document: WorkflowDocument = {
      ...createEmptyWorkflow(),
      name,
      startUrl: "",
      browser: browser as "chrome" | "edge",
      steps: [first] as unknown as WorkflowDocument["steps"],
    };
    const item: StoredWorkflow = { id: createId(), document, updatedAt: new Date().toISOString() };
    setWorkflowLibrary((all) => [...all, item]);
    activateWorkflow(item);
    recorderLastScrollY.current = 0;
    const result = await window.flowforge.recorderStart({
      startUrl: recordUrl,
      browser,
      profile: { name: profileName, browser, userDataDir: userDataDir || undefined },
    });
    if (result.ok) {
      setRecording(true);
      setRunning(true);
      setLogs([
        `Recording started at ${recordUrl}. A new workflow was created so your existing workflow stays safe. Use the website normally: clicks, double/right-clicks, typing, dropdowns, keyboard shortcuts, scrolling, navigation, and supported drag/drop interactions are captured. Password and payment fields are excluded. Stop recording to edit the generated steps.`,
      ]);
    } else setLogs((old) => [...old, result.error || "Could not start recorder."]);
  };
  const stopRecorder = async () => {
    const result = await window.flowforge.recorderStop();
    if (!result.ok) setLogs((old) => [...old, result.error || "Could not stop recorder."]);
  };
  const refreshProfiles = async () => {
    try {
      const result = await window.flowforge.listProfiles();
      setProfiles(result);
      for (const item of result) {
        if (!sessionNamesByProfile[item.name]) {
          const names = await window.flowforge.listSessions(item.name);
          setSessionNamesByProfile((old) => ({ ...old, [item.name]: names }));
        }
      }
    } catch (e) {
      setLogs((old) => [...old, `Could not load profiles: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };
  useEffect(() => {
    void refreshProfiles();
  }, []);
  const refreshSessions = async (name: string) => {
    if (!name) return;
    try {
      const names = await window.flowforge.listSessions(name);
      setSessionNamesByProfile((old) => ({ ...old, [name]: names }));
    } catch {}
  };
  const saveProfile = async () => {
    const r = await window.flowforge.saveProfile({
      name: profileName,
      browser,
      userDataDir,
      optimizations: { disableImages, disableCss, disableFonts, disableMedia, pageLoadStrategy, headless },
    });
    if (r.ok) {
      await refreshProfiles();
      setWorkflowProfileName(profileName);
    }
    setLogs((old) => [...old, `Profile saved: ${r.path || profileName}`]);
  };
  const exportSession = async () => {
    const r = await window.flowforge.sessionExport();
    if (!r.ok) setLogs((old) => [...old, r.error || "Could not export session."]);
    else
      setLogs((old) => [
        ...old,
        "Session export requested. The browser must be running on the origin you want to capture.",
      ]);
  };
  const importSession = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        if (f.size > 2_000_000) throw new Error("Session file exceeds the 2 MB limit.");
        const snapshot = validateSessionSnapshot(JSON.parse(await f.text()));
        const r = await window.flowforge.sessionImport(snapshot);
        if (!r.ok) throw new Error(r.error || "No browser session is running.");
        setLogs((old) => [...old, `Validated session snapshot for ${snapshot.origin}; import queued.`]);
      } catch (e) {
        setLogs((old) => [...old, `Session import rejected: ${e instanceof Error ? e.message : String(e)}`]);
      }
    };
    input.click();
  };
  const downloadJson = (value: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const getWorkflowPackage = () =>
    buildWorkflowPackage(workflowId, workflowLibrary, { id: workflowId, document: workflowDocument });
  const getWorkflowPackageFor = (rootId: string) =>
    buildWorkflowPackage(rootId, workflowLibrary, { id: workflowId, document: workflowDocument });
  const exportWorkflow = () => {
    try {
      downloadJson(
        getWorkflowPackage(),
        `${workflowName.trim().replace(/[^a-z0-9-_]+/gi, "-") || "workflow"}.flowforge.json`,
      );
      setLogs((old) => [...old, "Workflow package exported, including referenced sub-workflows."]);
    } catch (e) {
      setLogs((old) => [...old, `Export failed: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };
  const exportWorkflowFor = (item: StoredWorkflow) => {
    try {
      downloadJson(
        getWorkflowPackageFor(item.id),
        `${item.document.name.replace(/[^a-z0-9-_]+/gi, "-") || "workflow"}.flowforge.json`,
      );
      setLogs((old) => [...old, `Exported ${item.document.name} with its referenced sub-workflows.`]);
    } catch (e) {
      setLogs((old) => [...old, `Export failed: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };
  const activateWorkflow = (item: StoredWorkflow) => {
    setWorkflowLibrary((all) =>
      all.map((existing) =>
        existing.id === workflowId
          ? { ...existing, document: workflowDocument, updatedAt: new Date().toISOString() }
          : existing,
      ),
    );
    setWorkflowId(item.id);
    setWorkflowName(item.document.name);
    setSteps(item.document.steps as unknown as Step[]);
    setStartUrl(item.document.startUrl);
    setBrowser(item.document.browser);
    setWorkflowProfileName(item.document.profileName || "");
    setGroups(item.document.groups);
    setVariables(item.document.variables);
    setSelected(item.document.steps[0]?.id || "");
    setTab("workflow");
    setSaveState("Saved locally");
  };
  const newWorkflow = () => {
    const doc: WorkflowDocument = {
      ...createEmptyWorkflow(),
      name: `Workflow ${workflowLibrary.length + 1}`,
      steps: [
        { ...makeStep("navigate"), name: "Open website", url: "https://example.com" },
      ] as unknown as WorkflowDocument["steps"],
    };
    const item = { id: createId(), document: doc, updatedAt: new Date().toISOString() };
    setWorkflowLibrary((all) => [...all, item]);
    activateWorkflow(item);
    setCommandOpen(false);
    setCommandQuery("");
  };
  const duplicateWorkflow = (item: StoredWorkflow) => {
    const doc = normalizeWorkflow({
      ...item.document,
      name: `${item.document.name} copy`,
      steps: item.document.steps.map((step) => ({ ...step, id: createId() })),
    });
    const clone = { id: createId(), document: doc, updatedAt: new Date().toISOString() };
    setWorkflowLibrary((all) => [...all, clone]);
    activateWorkflow(clone);
    setLogs((old) => [...old, `Duplicated workflow: ${doc.name}`]);
  };
  const deleteWorkflow = (id: string) => {
    if (workflowLibrary.length <= 1) {
      setLogs((old) => [...old, "Keep at least one workflow in your library."]);
      return;
    }
    const dependents = workflowLibrary.filter(
      (item) =>
        item.id !== id &&
        item.document.steps.some((step) => step.type === "runWorkflow" && step.workflowId === id),
    );
    if (dependents.length) {
      setLogs((old) => [
        ...old,
        `Cannot delete this workflow because it is used by: ${dependents.map((item) => item.document.name).join(", ")}. Remove those workflow actions first.`,
      ]);
      return;
    }
    const next = workflowLibrary.filter((item) => item.id !== id);
    setWorkflowLibrary(next);
    if (workflowId === id) activateWorkflow(next[0]);
    setLogs((old) => [...old, "Workflow removed from the local library."]);
  };
  const importWorkflow = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        if (f.size > 5_000_000) throw new Error("Workflow JSON exceeds the 5 MB import limit.");
        const parsed = JSON.parse(await f.text());
        const imported = importWorkflowPackage(parsed);
        setWorkflowLibrary((all) => [...all, ...imported.workflows]);
        const root =
          imported.workflows.find((item) => item.id === imported.rootWorkflowId) || imported.workflows[0];
        activateWorkflow(root);
        setLogs((old) => [
          ...old,
          `Imported ${imported.workflows.length} workflow${imported.workflows.length === 1 ? "" : "s"} from ${f.name}.`,
        ]);
      } catch (e) {
        setLogs((old) => [...old, `Import rejected: ${e instanceof Error ? e.message : String(e)}`]);
      }
    };
    input.click();
  };
  const applyTemplate = (kind: "starter" | "form" | "search") => {
    const id = () => createId();
    const templates: Record<typeof kind, { name: string; url: string; steps: Step[] }> = {
      starter: {
        name: "Website smoke check",
        url: "https://example.com",
        steps: [
          { ...makeStep("navigate"), id: id(), name: "Open website", url: "https://example.com" },
          {
            ...makeStep("waitVisible"),
            id: id(),
            name: "Wait for page heading",
            target: { strategy: "css", value: "h1" },
            timeout: 10000,
          },
          {
            ...makeStep("assertText"),
            id: id(),
            name: "Verify heading text",
            target: { strategy: "css", value: "h1" },
            expected: "Example Domain",
            timeout: 10000,
          },
        ],
      },
      form: {
        name: "Form entry starter",
        url: "https://example.com",
        steps: [
          { ...makeStep("navigate"), id: id(), name: "Open form page", url: "https://example.com" },
          {
            ...makeStep("waitVisible"),
            id: id(),
            name: "Wait for form field",
            target: { strategy: "css", value: 'input[name="email"]' },
            timeout: 10000,
          },
          {
            ...makeStep("type"),
            id: id(),
            name: "Enter email",
            target: { strategy: "css", value: 'input[name="email"]' },
            text: "name@example.com",
            clearFirst: true,
          },
          {
            ...makeStep("click"),
            id: id(),
            name: "Submit form",
            target: { strategy: "css", value: 'button[type="submit"]' },
            timeout: 10000,
          },
        ],
      },
      search: {
        name: "Search page starter",
        url: "https://example.com",
        steps: [
          { ...makeStep("navigate"), id: id(), name: "Open search page", url: "https://example.com" },
          {
            ...makeStep("waitVisible"),
            id: id(),
            name: "Wait for search input",
            target: { strategy: "css", value: 'input[type="search"]' },
            timeout: 10000,
          },
          {
            ...makeStep("type"),
            id: id(),
            name: "Enter search query",
            target: { strategy: "css", value: 'input[type="search"]' },
            text: "replace with your query",
            clearFirst: true,
          },
          {
            ...makeStep("key"),
            id: id(),
            name: "Submit search",
            target: { strategy: "css", value: 'input[type="search"]' },
            key: "ENTER",
            timeout: 10000,
          },
        ],
      },
    };
    const template = templates[kind];
    setWorkflowName(template.name);
    setStartUrl(template.url);
    setSteps(template.steps);
    setSelected(template.steps[0]?.id || "");
    setGroups([]);
    setVariables([]);
    setTab("workflow");
    setCommandOpen(false);
    setCommandQuery("");
    setLogs((old) =>
      [...old, `Loaded template: ${template.name}. Replace example selectors and URLs before running.`].slice(
        -300,
      ),
    );
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        setCommandQuery("");
      } else if (event.key === "Escape") {
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (commandOpen) commandInputRef.current?.focus();
  }, [commandOpen]);
  useEffect(() => {
    void window.flowforge
      .getVersion()
      .then((version) => {
        if (version) setAppVersion(version);
      })
      .catch(() => {});
  }, []);
  const checkForUpdates = async (showStatus = false) => {
    setUpdateChecking(true);
    if (showStatus) setUpdateMessage("");
    try {
      const result = await window.flowforge.checkForUpdates();
      if (result.available) {
        setUpdateInfo(result);
        setUpdateMessage("");
      } else {
        setUpdateInfo(null);
        if (showStatus)
          setUpdateMessage(
            result.ok
              ? t("You are up to date.")
              : t("Could not check for updates.") + (result.error ? ` ${result.error}` : ""),
          );
      }
    } catch {
      if (showStatus) setUpdateMessage(t("Could not check for updates."));
    } finally {
      setUpdateChecking(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkForUpdates(false);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, []);
  return {
    steps,
    setSteps,
    workflowName,
    setWorkflowName,
    workflowId,
    setWorkflowId,
    workflowLibrary,
    setWorkflowLibrary,
    libraryReady,
    setLibraryReady,
    groups,
    setGroups,
    variables,
    setVariables,
    variableSearch,
    setVariableSearch,
    selectedVariableId,
    setSelectedVariableId,
    saveState,
    setSaveState,
    selected,
    setSelected,
    tab,
    setTab,
    theme,
    setTheme,
    language,
    setLanguage,
    commandOpen,
    setCommandOpen,
    appVersion,
    setAppVersion,
    updateInfo,
    setUpdateInfo,
    updateChecking,
    setUpdateChecking,
    updateMessage,
    setUpdateMessage,
    userInputPrompt,
    setUserInputPrompt,
    commandQuery,
    setCommandQuery,
    browser,
    setBrowser,
    startUrl,
    setStartUrl,
    disableImages,
    setDisableImages,
    headless,
    setHeadless,
    disableCss,
    setDisableCss,
    disableFonts,
    setDisableFonts,
    disableMedia,
    setDisableMedia,
    pageLoadStrategy,
    setPageLoadStrategy,
    closeBrowser,
    setCloseBrowser,
    scheduleEnabled,
    setScheduleEnabled,
    scheduleEvery,
    setScheduleEvery,
    scheduleUnit,
    setScheduleUnit,
    scheduleStartup,
    setScheduleStartup,
    profileName,
    setProfileName,
    workflowProfileName,
    setWorkflowProfileName,
    profiles,
    setProfiles,
    sessionNamesByProfile,
    setSessionNamesByProfile,
    userDataDir,
    setUserDataDir,
    running,
    setRunning,
    recording,
    setRecording,
    recordUrl,
    setRecordUrl,
    logs,
    setLogs,
    runState,
    setRunState,
    runHistory,
    setRunHistory,
    outputArchives,
    setOutputArchives,
    outputRefreshToken,
    setOutputRefreshToken,
    outputPreview,
    setOutputPreview,
    stepSearch,
    setStepSearch,
    t,
    dateLocale,
    commandInputRef,
    recorderLastScrollY,
    activeRunId,
    current,
    workflowDocument,
    validation,
    update,
    updateNested,
    addNested,
    patchNested,
    removeNested,
    submitUserInput,
    cancelUserInput,
    addStep,
    duplicateStep,
    addGroup,
    addVariable,
    updateVariable,
    duplicateVariable,
    variableNameError,
    deleteStep,
    move,
    run,
    scheduledRunRef,
    startRecorder,
    stopRecorder,
    refreshProfiles,
    refreshSessions,
    saveProfile,
    exportSession,
    importSession,
    downloadJson,
    getWorkflowPackage,
    getWorkflowPackageFor,
    exportWorkflow,
    exportWorkflowFor,
    activateWorkflow,
    newWorkflow,
    duplicateWorkflow,
    deleteWorkflow,
    importWorkflow,
    applyTemplate,
    checkForUpdates,
  };
}

export type AppController = ReturnType<typeof useAppController>;
