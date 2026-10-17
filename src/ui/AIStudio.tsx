import { useEffect, useMemo, useState } from "react";
import type { StoredWorkflow } from "../core/workflowLibrary";
import { Zap as Brain, Layers3 as Network, Copy, Check, Globe2 as ExternalLink, Activity as Bot, CircleHelp, Layers3 as Workflow, ShieldCheck as KeyRound } from "./AnimatedIcons";

type ApiInfo = { available: boolean; baseUrl: string; token: string; authHeader: string; docsPath: string };
type Props = {
  workflows: StoredWorkflow[];
  onOpenWorkflow: (id: string) => void;
  onTagWorkflow: (id: string, provenance: "generated" | "human-guided" | "ai-assisted") => void;
};
export default function AIStudio({ workflows, onOpenWorkflow, onTagWorkflow }: Props) {
  const [api, setApi] = useState<ApiInfo | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<Array<{ id?: string; action: string; url?: string; title?: string; target?: { value?: string; text?: string; strategy?: string }; text?: string; value?: string; selectedText?: string; at?: number }>>([]);
  const [recorderUrl, setRecorderUrl] = useState("https://example.com");
  const [recording, setRecording] = useState(false);
  const [recorderMessage, setRecorderMessage] = useState("");
  useEffect(() => { window.flowforge.getAiApiInfo().then(setApi).catch(() => setApi(null)); }, []);
  useEffect(() => { window.flowforge.syncAiWorkflows(workflows).catch(() => {}); }, [workflows]);
  useEffect(() => { window.flowforge.getAiGuidanceActions().then(setGuidance).catch(() => {}); }, []);
  const visible = useMemo(() => workflows.filter(w => `${w.document.name} ${w.document.startUrl}`.toLowerCase().includes(search.toLowerCase())), [workflows, search]);
  const edges = useMemo(() => workflows.flatMap(w => w.document.steps.filter(s => s.type === "runWorkflow" && s.workflowId).map(s => ({ source: w, target: workflows.find(x => x.id === s.workflowId), step: s }))), [workflows]);
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1800); } catch {}
  };
  const taskPrompt = `You are controlling FlowForge through its authenticated local API/MCP tools. Goal: ${query || "[describe the task]"}.
First inspect existing workflows and the workflow graph. Reuse nested workflows where appropriate. Validate changes before execution. If blocked, pause and ask the user for a specific action or choice; never guess passwords, MFA, CAPTCHA, or consequential approvals. Record only non-secret guidance, propose editable workflow changes, and ask before saving learned steps. Verify the final result.`;
  return <main className="single-panel ai-studio">
    <div className="ai-hero">
      <div className="ai-hero-icon"><Brain size={25}/></div>
      <div className="ai-hero-copy"><div className="eyebrow">FLOWFORGE INTELLIGENCE</div><h1>AI Studio</h1><p>Connect an AI agent, explore nested workflows, and turn guided work into reusable automation.</p></div>
      <span className="ai-pill"><Bot size={14}/> AI INTEGRATION</span>
    </div>
    <div className="ai-studio-grid">
      <section className="ai-card ai-task-card">
        <div className="ai-section-title"><div><Brain size={17}/><h2>Give an AI agent a task</h2></div><span>Agent-ready</span></div>
        <p className="ai-muted">Copy a task brief into your connected MCP-compatible AI client. The agent can discover, inspect, and run workflows through the local API.</p>
        <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="Example: Sign in to the portal, find this month's invoice, and save it to outputs. Ask me if authentication or a decision is needed." rows={4}/>
        <button className="primary-button" onClick={()=>copy(taskPrompt,"task")}>{copied==="task"?<Check size={14}/>:<Copy size={14}/>} {copied==="task"?"Copied task brief":"Copy task brief"}</button>
        <div className="ai-safety-note"><CircleHelp size={16}/><span>Human assistance is an explicit checkpoint. Sensitive answers are not intended to become reusable workflow data.</span></div>
      </section>
      <section className="ai-card">
        <div className="ai-section-title"><div><KeyRound size={17}/><h2>Local AI API</h2></div><span className="ai-status-dot">{api?.available?"● Local API online":"● API unavailable"}</span></div>
        <p className="ai-muted">The authenticated API listens on loopback only. Keep this token private; any process that has it can operate your local automation.</p>
        <label>Base URL</label><div className="ai-copy-field"><code>{api?.baseUrl || "Starting local API…"}</code><button className="square-button" onClick={()=>api&&copy(api.baseUrl,"url")} title="Copy base URL"><Copy size={14}/></button></div>
        <label>Bearer token</label><div className="ai-copy-field"><code>{api?.token ? `${api.token.slice(0,8)}••••••••••••••••••••••••••••${api.token.slice(-4)}` : "Loading secure token…"}</code><button className="square-button" onClick={()=>api&&copy(api.token,"token")} title="Copy token"><Copy size={14}/></button></div>
        {copied==="token"&&<p className="ai-success">Token copied. Paste it only into a trusted local AI client.</p>}
        <div className="ai-api-links"><a href="https://modelcontextprotocol.io/" target="_blank" rel="noreferrer"><ExternalLink size={13}/> MCP client documentation</a><button className="text-button" onClick={()=>copy(`curl -H "Authorization: Bearer ${api?.token || "<token>"}" ${api?.baseUrl || "http://127.0.0.1:43127"}/v1/workflows`,"curl")}>{copied==="curl"?<Check size={13}/>:<Copy size={13}/>} Copy API example</button></div>
        <div className="ai-endpoints"><b>Available endpoints</b><code>GET /v1/workflows</code><code>GET /v1/workflow-graph</code><code>GET /v1/workflows/:id</code><code>POST /v1/runs</code><code>GET /v1/runs/active</code><code>POST /v1/runs/input</code></div>
      </section>
    </div>
    <section className="ai-card graph-card">
      <div className="ai-section-title"><div><Network size={18}/><h2>Workflow dependency graph</h2></div><span>{workflows.length} workflows · {edges.length} nested links</span></div>
      <div className="ai-graph-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search workflows…"/><span>Click a node to open its editor</span></div>
      <div className="ai-node-grid">
        {visible.map(w=><article key={w.id} className="ai-node">
          <div className="ai-node-top"><div className="ai-node-icon"><Workflow size={17}/></div><div className="ai-node-title"><b>{w.document.name}</b><small>{w.document.steps.length} steps · {w.document.browser}</small></div>{w.aiTag&&<span className="ai-tag">AI</span>}</div>
          <div className="ai-node-url">{w.document.startUrl || "No start URL"}</div>
          <div className="ai-node-actions"><button className="secondary-button" onClick={()=>onOpenWorkflow(w.id)}>Open workflow</button>{!w.aiTag&&<button className="text-button" onClick={()=>onTagWorkflow(w.id,"ai-assisted")}>Mark AI-assisted</button>}</div>
          {edges.filter(e=>e.source.id===w.id).map(e=><button className="ai-edge" key={`${w.id}-${e.step.id}`} onClick={()=>e.target&&onOpenWorkflow(e.target.id)}><span>↓</span><span>{e.step.name} <b>→ {e.target?.document.name || "Missing workflow"}</b></span></button>)}
        </article>)}
      </div>
      {visible.length===0&&<div className="ai-empty">No workflows match that search.</div>}
      <div className="ai-graph-legend"><span><i/> Workflow node</span><span><i className="ai-legend-edge"/> Nested workflow dependency</span><span><i className="ai-legend-tag"/> AI-tagged workflow</span></div>
    </section>
    <section className="ai-card">
      <div className="ai-section-title"><div><Check size={17}/><h2>Record user guidance</h2></div><span>{guidance.length} captured actions</span></div>
      <p className="ai-muted">Start a recorder session, perform the browser steps that teach the AI what to do, then stop recording. Password and likely payment/OTP fields are excluded by the recorder.</p>
      <div className="ai-recorder-controls"><input value={recorderUrl} onChange={e=>setRecorderUrl(e.target.value)} placeholder="https://site.example"/>{!recording?<button className="primary-button" onClick={async()=>{const result=await window.flowforge.recorderStart({startUrl:recorderUrl,browser:"chrome"});setRecording(!!result.ok);setRecorderMessage(result.ok?"Recorder started. Complete the task in the opened browser.":result.error||"Could not start recorder.");}}><Bot size={14}/> Start recording</button>:<button className="stop-button" onClick={async()=>{const result=await window.flowforge.recorderStop();setRecording(false);setRecorderMessage(result.ok?"Recorder stopping. Refresh actions in a moment.":result.error||"Could not stop recorder.");window.setTimeout(()=>window.flowforge.getAiGuidanceActions().then(setGuidance).catch(()=>{}),1200);}}><Check size={14}/> Stop & review</button>}<button className="secondary-button" onClick={()=>window.flowforge.getAiGuidanceActions().then(setGuidance).catch(()=>{})}>Refresh actions</button></div>
      {recorderMessage&&<p className="ai-muted">{recorderMessage}</p>}
      <div className="ai-guidance-list">{guidance.slice(-12).reverse().map((action,index)=><div className="ai-guidance-row" key={action.id||`${action.at||index}-${index}`}><span className="ai-guidance-action">{action.action}</span><div><b>{action.target?.text||action.target?.value||action.selectedText||action.title||action.url||"Page action"}</b><small>{action.url||""}{action.text?` · ${action.text.slice(0,100)}`:""}{action.value?` · ${action.value.slice(0,100)}`:""}</small></div></div>)}
      {!guidance.length&&<div className="ai-empty">No actions recorded yet. Start a session to capture non-sensitive browser guidance.</div>}</div>
    </section>
    <section className="ai-card">
      <div className="ai-section-title"><div><Check size={17}/><h2>Human-guided learning</h2></div><span>Approval-first</span></div>
      <p className="ai-muted">When an AI agent gets stuck, it should ask for a specific action or choice, resume from the current checkpoint, and propose the non-sensitive actions as editable steps. Tag the resulting workflow with its origin so generated and human-guided work stays auditable.</p>
      <div className="ai-learning-steps"><div><b>1. Ask</b><span>Explain the blocker and offer clear options.</span></div><div><b>2. Capture</b><span>Record relevant selectors, choices, and action outcomes, excluding secrets.</span></div><div><b>3. Review</b><span>Preview the proposed workflow changes and validate them.</span></div><div><b>4. Reuse</b><span>Approve, save, and link the reusable subflow in the graph.</span></div></div>
    </section>
  </main>;
}
