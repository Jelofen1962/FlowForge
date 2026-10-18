import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Circle, CircleHelp, Copy, ExternalLink, KeyRound, MessageSquare, Network, RefreshCw, Search, Send, Sparkles, Square, Workflow as WorkflowIcon, GraduationCap, ClipboardList } from "lucide-react";
import type { StoredWorkflow } from "../core/workflowLibrary";
import { Badge, Button, Field, Icon, IconButton, Input, Note, Section, StatusDot, Textarea } from "./components";
import { Page, PageHeader } from "./layout/Page";

type ApiInfo = { available: boolean; baseUrl: string; token: string; authHeader: string; docsPath: string };
type Guidance = { id?: string; action: string; url?: string; title?: string; target?: { value?: string; text?: string; strategy?: string }; text?: string; value?: string; selectedText?: string; at?: number };
type Props = {
  workflows: StoredWorkflow[];
  onOpenWorkflow: (id: string) => void;
  onTagWorkflow: (id: string, provenance: "generated" | "human-guided" | "ai-assisted") => void;
  t?: (text: string) => string;
};

export default function AIStudio({ workflows, onOpenWorkflow, onTagWorkflow, t = text => text }: Props) {
  const [api, setApi] = useState<ApiInfo | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");
  const [guidance, setGuidance] = useState<Guidance[]>([]);
  const [recorderUrl, setRecorderUrl] = useState("https://example.com");
  const [recording, setRecording] = useState(false);
  const [recorderMessage, setRecorderMessage] = useState("");
  const [providerUrl, setProviderUrl] = useState("http://localhost:20128/v1");
  const [providerModel, setProviderModel] = useState("MCP");
  const [providerKey, setProviderKey] = useState("");
  const [providerHasKey, setProviderHasKey] = useState(false);
  const [providerStatus, setProviderStatus] = useState("");
  const [providerBusy, setProviderBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.flowforge.getAiApiInfo().then(setApi).catch(() => setApi(null)); }, []);
  useEffect(() => { window.flowforge.getAiProviderSettings().then(settings => { setProviderUrl(settings.baseUrl); setProviderModel(settings.model); setProviderHasKey(settings.hasApiKey); }).catch(() => {}); }, []);
  useEffect(() => { window.flowforge.syncAiWorkflows(workflows).catch(() => {}); }, [workflows]);
  useEffect(() => { window.flowforge.getAiGuidanceActions().then(setGuidance).catch(() => {}); }, []);
  useEffect(() => { const node = chatRef.current; if (node) node.scrollTop = node.scrollHeight; }, [chatMessages, chatBusy]);

  const visible = useMemo(() => workflows.filter(w => `${w.document.name} ${w.document.startUrl}`.toLowerCase().includes(search.toLowerCase())), [workflows, search]);
  const edges = useMemo(() => workflows.flatMap(w => w.document.steps.filter(s => s.type === "runWorkflow" && s.workflowId).map(s => ({ source: w, target: workflows.find(x => x.id === s.workflowId), step: s }))), [workflows]);
  const copy = async (text: string, key: string) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1800); } catch { /* clipboard unavailable */ } };
  const refreshGuidance = () => window.flowforge.getAiGuidanceActions().then(setGuidance).catch(() => {});

  const taskPrompt = `You are controlling FlowForge through its authenticated local API/MCP tools. Goal: ${query || "[describe the task]"}.
First inspect existing workflows and the workflow graph. Reuse nested workflows where appropriate. Validate changes before execution. If blocked, pause and ask the user for a specific action or choice; never guess passwords, MFA, CAPTCHA, or consequential approvals. Record only non-secret guidance, propose editable workflow changes, and ask before saving learned steps. Verify the final result.`;

  const sendChat = () => {
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    setChatInput("");
    setChatMessages(previous => [...previous, { role: "user", text: message }]);
    setChatBusy(true);
    window.flowforge.sendAiMessage({ message })
      .then(result => setChatMessages(previous => [...previous, { role: "assistant", text: result.ok ? result.text || "The model returned an empty response." : result.error || "Request failed." }]))
      .catch(error => setChatMessages(previous => [...previous, { role: "assistant", text: String(error) }]))
      .finally(() => setChatBusy(false));
  };

  const saveProvider = async () => {
    setProviderBusy(true); setProviderStatus("");
    const result = await window.flowforge.saveAiProviderSettings({ baseUrl: providerUrl, model: providerModel, apiKey: providerKey || undefined });
    setProviderBusy(false);
    if (result.ok) { setProviderHasKey(!!result.hasApiKey); setProviderKey(""); setProviderStatus("Settings saved."); }
    else setProviderStatus(result.error || "Could not save settings.");
  };
  const testProvider = async () => {
    setProviderBusy(true); setProviderStatus("Testing connection…");
    const saved = await window.flowforge.saveAiProviderSettings({ baseUrl: providerUrl, model: providerModel, apiKey: providerKey || undefined });
    if (!saved.ok) { setProviderStatus(saved.error || "Could not save settings."); setProviderBusy(false); return; }
    setProviderHasKey(!!saved.hasApiKey); setProviderKey("");
    const result = await window.flowforge.testAiProvider();
    setProviderBusy(false);
    setProviderStatus(result.ok ? `Connected. ${result.models?.length ? `Models found: ${result.models.join(", ")}` : result.message || "API reachable."}` : result.error || "Connection failed.");
  };
  const providerOk = providerStatus.startsWith("Connected") || providerStatus === "Settings saved.";

  return (
    <Page label="AI Studio">
      <PageHeader
        eyebrow="FLOWFORGE INTELLIGENCE"
        title="AI Studio"
        description={t("Connect an AI agent, explore nested workflows, and turn guided work into reusable automation.")}
        actions={<Badge tone="solid" icon={Sparkles}>AI INTEGRATION</Badge>}
      />

      <div className="ai-grid">
        <div className="ai-col">
          <Section icon={KeyRound} title="9Router provider" actions={<Badge tone={providerHasKey ? "primary" : "warning"}>{providerHasKey ? t("Key saved securely") : t("Setup required")}</Badge>}>
            <p className="card-desc">{t("Connect the OpenAI-compatible API. The key is saved to the app's local user-data folder and never sent to the renderer after saving.")}</p>
            <Field label={t("API base URL")}><Input mono value={providerUrl} onChange={e => setProviderUrl(e.target.value)} placeholder="http://localhost:20128/v1" /></Field>
            <div className="form-grid cols-2">
              <Field label={t("Model ID")}><Input mono value={providerModel} onChange={e => setProviderModel(e.target.value)} placeholder="MCP" /></Field>
              <Field label={t("API key")}><Input type="password" autoComplete="new-password" value={providerKey} onChange={e => setProviderKey(e.target.value)} placeholder={providerHasKey ? t("Saved key. Leave blank to keep it.") : t("Paste 9Router API key")} /></Field>
            </div>
            <div className="row">
              <Button variant="primary" disabled={providerBusy} onClick={saveProvider}>{t("Save provider")}</Button>
              <Button disabled={providerBusy} onClick={testProvider} icon={RefreshCw} iconSpinning={providerBusy} iconAnim="spin">{t("Test connection")}</Button>
            </div>
            {providerStatus && <Note tone={providerOk ? "primary" : "neutral"} icon={providerOk ? Check : CircleHelp}><span role="status">{providerStatus}</span></Note>}
          </Section>

          <Section icon={Bot} title={t("Give an AI agent a task")} actions={<Badge>{t("Agent-ready")}</Badge>}>
            <p className="card-desc">{t("Copy a task brief into your connected MCP-compatible AI client. The agent can discover, inspect, and run workflows through the local API.")}</p>
            <Textarea value={query} onChange={e => setQuery(e.target.value)} rows={4} placeholder={t("Example: Sign in to the portal, find this month's invoice, and save it to outputs. Ask me if authentication or a decision is needed.")} aria-label={t("Task description")} />
            <div><Button variant="primary" icon={copied === "task" ? Check : Copy} iconAnim="pop" onClick={() => copy(taskPrompt, "task")}>{copied === "task" ? t("Copied task brief") : t("Copy task brief")}</Button></div>
            <Note icon={CircleHelp}>{t("Human assistance is an explicit checkpoint. Sensitive answers are not intended to become reusable workflow data.")}</Note>
          </Section>
        </div>

        <div className="ai-col">
          <Section icon={MessageSquare} title={t("FlowForge AI assistant")} actions={<Badge>9Router + tools</Badge>}>
            <p className="card-desc">{t("Ask the assistant to inspect workflows or, when explicitly requested, run a workflow. Tool calls use the local authenticated FlowForge API.")}</p>
            <div className="chat-log" ref={chatRef} aria-live="polite" aria-label={t("Conversation")}>
              {chatMessages.map((message, index) => (
                <div className={`bubble ${message.role}`} key={`${index}-${message.role}`}><b>{message.role === "user" ? t("You") : "FlowForge AI"}</b><p>{message.text}</p></div>
              ))}
              {!chatMessages.length && <div className="chat-empty">{t("Try “List my workflows” to test MCP tool calling.")}</div>}
              {chatBusy && <div className="bubble"><b>FlowForge AI</b><p><Icon icon={RefreshCw} size={13} spinning /> {t("Thinking and using tools…")}</p></div>}
            </div>
            <Textarea value={chatInput} onChange={e => setChatInput(e.target.value)} rows={3} aria-label={t("Message")} placeholder={t("Ask FlowForge to inspect or run an automation…")}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
            <div className="row-between">
              <span className="field-hint">Enter ↵ {t("to send")} · Shift+Enter {t("for a new line")}</span>
              <Button variant="primary" disabled={chatBusy || !chatInput.trim()} icon={Send} iconAnim="nudge" onClick={sendChat}>{t("Send to AI")}</Button>
            </div>
          </Section>

          <Section icon={KeyRound} title={t("Local AI API")} actions={<span className="status-item" style={{ fontSize: 12 }}><StatusDot tone={api?.available ? "live" : "danger"} />{api?.available ? t("Local API online") : t("API unavailable")}</span>}>
            <p className="card-desc">{t("The authenticated API listens on loopback only. Keep this token private; any process that has it can operate your local automation.")}</p>
            <Field as="div" label={t("Base URL")}>
              <div className="copy-field"><code>{api?.baseUrl || t("Starting local API…")}</code><IconButton variant="outline" icon={copied === "url" ? Check : Copy} iconAnim="pop" label={t("Copy base URL")} onClick={() => api && copy(api.baseUrl, "url")} /></div>
            </Field>
            <Field as="div" label={t("Bearer token")}>
              <div className="copy-field"><code>{api?.token ? `${api.token.slice(0, 8)}••••••••••••••••${api.token.slice(-4)}` : t("Loading secure token…")}</code><IconButton variant="outline" icon={copied === "token" ? Check : Copy} iconAnim="pop" label={t("Copy token")} onClick={() => api && copy(api.token, "token")} /></div>
            </Field>
            {copied === "token" && <Note tone="primary" icon={Check}>{t("Token copied. Paste it only into a trusted local AI client.")}</Note>}
            <div className="row">
              <Button size="sm" variant="ghost" icon={ExternalLink} iconAnim="nudge" onClick={() => window.flowforge.openExternal("https://modelcontextprotocol.io/")}>{t("MCP client documentation")}</Button>
              <Button size="sm" variant="ghost" icon={copied === "curl" ? Check : Copy} iconAnim="pop" onClick={() => copy(`curl -H "Authorization: Bearer ${api?.token || "<token>"}" ${api?.baseUrl || "http://127.0.0.1:43127"}/v1/workflows`, "curl")}>{t("Copy API example")}</Button>
            </div>
            <div className="endpoints" aria-label={t("Available endpoints")}>
              {["GET /v1/workflows", "GET /v1/workflow-graph", "GET /v1/workflows/:id", "POST /v1/runs", "GET /v1/runs/active", "POST /v1/runs/input"].map(endpoint => <code key={endpoint}>{endpoint}</code>)}
            </div>
          </Section>
        </div>
      </div>

      <Section icon={Network} title={t("Workflow dependency graph")} actions={<Badge>{workflows.length} {t("workflows")} · {edges.length} {t("nested links")}</Badge>}>
        <div className="input-group"><Icon icon={Search} size={14} /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search workflows…")} aria-label={t("Search workflows…")} /></div>
        <div className="node-grid">
          {visible.map(w => (
            <article key={w.id} className="node">
              <div className="tile-top">
                <span className="tile-glyph"><Icon icon={WorkflowIcon} size={17} /></span>
                <div className="list-item-copy"><strong>{w.document.name}</strong><small>{w.document.steps.length} {t("steps")} · {w.document.browser}</small></div>
                {w.aiTag && <Badge tone="solid">AI</Badge>}
              </div>
              <div className="node-url">{w.document.startUrl || t("No start URL configured")}</div>
              <div className="row">
                <Button size="sm" onClick={() => onOpenWorkflow(w.id)}>{t("Open workflow")}</Button>
                {!w.aiTag && <Button size="sm" variant="ghost" onClick={() => onTagWorkflow(w.id, "ai-assisted")}>{t("Mark AI-assisted")}</Button>}
              </div>
              {edges.filter(e => e.source.id === w.id).map(e => (
                <button type="button" className="edge" key={`${w.id}-${e.step.id}`} onClick={() => e.target && onOpenWorkflow(e.target.id)}><span aria-hidden="true">↳</span><span>{e.step.name} <b>→ {e.target?.document.name || t("Missing workflow")}</b></span></button>
              ))}
            </article>
          ))}
        </div>
        {visible.length === 0 && <p className="muted">{t("No workflows match that search.")}</p>}
        <div className="legend"><span><i />{t("Workflow node")}</span><span><i className="edge-l" />{t("Nested workflow dependency")}</span><span><i className="tag-l" />{t("AI-tagged workflow")}</span></div>
      </Section>

      <Section icon={ClipboardList} title={t("Record user guidance")} actions={<Badge>{guidance.length} {t("captured actions")}</Badge>} defaultOpen={false}>
        <p className="card-desc">{t("Start a recorder session, perform the browser steps that teach the AI what to do, then stop recording. Password and likely payment/OTP fields are excluded by the recorder.")}</p>
        <div className="rec-bar">
          <div className="input-group"><Icon icon={Search} size={14} /><Input mono value={recorderUrl} onChange={e => setRecorderUrl(e.target.value)} placeholder="https://site.example" aria-label={t("Recorder start URL")} /></div>
          {!recording
            ? <Button variant="primary" icon={Circle} iconAnim="pulse" onClick={async () => { const result = await window.flowforge.recorderStart({ startUrl: recorderUrl, browser: "chrome" }); setRecording(!!result.ok); setRecorderMessage(result.ok ? "Recorder started. Complete the task in the opened browser." : result.error || "Could not start recorder."); }}>{t("Start recording")}</Button>
            : <Button variant="danger" icon={Square} iconAnim="pulse" onClick={async () => { const result = await window.flowforge.recorderStop(); setRecording(false); setRecorderMessage(result.ok ? "Recorder stopping. Refresh actions in a moment." : result.error || "Could not stop recorder."); window.setTimeout(refreshGuidance, 1200); }}>{t("Stop & review")}</Button>}
          <Button icon={RefreshCw} iconAnim="spin" onClick={refreshGuidance}>{t("Refresh actions")}</Button>
        </div>
        {recorderMessage && <p className="card-desc" role="status">{recorderMessage}</p>}
        <div>
          {guidance.slice(-12).reverse().map((action, index) => (
            <div className="guidance-row" key={action.id || `${action.at || index}-${index}`}>
              <Badge tone="primary">{action.action}</Badge>
              <div><b>{action.target?.text || action.target?.value || action.selectedText || action.title || action.url || t("Page action")}</b>
                <small>{action.url || ""}{action.text ? ` · ${action.text.slice(0, 100)}` : ""}{action.value ? ` · ${action.value.slice(0, 100)}` : ""}</small></div>
            </div>
          ))}
          {!guidance.length && <p className="muted">{t("No actions recorded yet. Start a session to capture non-sensitive browser guidance.")}</p>}
        </div>
      </Section>

      <Section icon={GraduationCap} title={t("Human-guided learning")} actions={<Badge>{t("Approval-first")}</Badge>} defaultOpen={false}>
        <p className="card-desc">{t("When an AI agent gets stuck, it should ask for a specific action or choice, resume from the current checkpoint, and propose the non-sensitive actions as editable steps. Tag the resulting workflow with its origin so generated and human-guided work stays auditable.")}</p>
        <div className="steps-4">
          <div><b>1 · {t("Ask")}</b><span>{t("Explain the blocker and offer clear options.")}</span></div>
          <div><b>2 · {t("Capture")}</b><span>{t("Record relevant selectors, choices, and action outcomes, excluding secrets.")}</span></div>
          <div><b>3 · {t("Review")}</b><span>{t("Preview the proposed workflow changes and validate them.")}</span></div>
          <div><b>4 · {t("Reuse")}</b><span>{t("Approve, save, and link the reusable subflow in the graph.")}</span></div>
        </div>
      </Section>
    </Page>
  );
}

