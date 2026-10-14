import { useMemo, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, Braces, Check, ChevronDown, CircleHelp,
  Clock3, Code2, Command, Copy, Database, Globe2, GripVertical, Layers3,
  ListFilter, MoreHorizontal, MousePointer2, PanelLeftClose, Play, Plus,
  Radio, RefreshCw, Search, Settings2, Square, Terminal, Trash2, Type,
  Workflow as WorkflowIcon, X, Zap
} from "lucide-react";
import { backend } from "./backend";
import type { StepKind, Workflow, WorkflowStep } from "./types";
import { stepLabels } from "./types";

const starter: Workflow = {
  id: "wf-product-scan",
  name: "Product price monitor",
  steps: [
    { id: "step-1", kind: "navigate", title: "Open product page", description: "Load the target page in the browser", value: "https://example.com/products", enabled: true },
    { id: "step-2", kind: "wait", title: "Wait for page", description: "Give dynamic content time to render", value: "1200", enabled: true },
    { id: "step-3", kind: "extract", title: "Extract product details", description: "Collect the name and current price", value: "name, price", enabled: true },
    { id: "step-4", kind: "click", title: "Open next result", description: "Move to the next product result", value: "button.next", enabled: true }
  ]
};

const palette: { kind: StepKind; title: string; description: string; icon: typeof Globe2 }[] = [
  { kind: "navigate", title: "Navigate", description: "Open a URL", icon: Globe2 },
  { kind: "click", title: "Click element", description: "Interact with a page", icon: MousePointer2 },
  { kind: "type", title: "Type text", description: "Enter text into a field", icon: Type },
  { kind: "wait", title: "Wait", description: "Pause execution", icon: Clock3 },
  { kind: "extract", title: "Extract data", description: "Capture page data", icon: Database }
];

function iconFor(kind: StepKind) {
  switch (kind) {
    case "navigate": return Globe2;
    case "click": return MousePointer2;
    case "type": return Type;
    case "wait": return Clock3;
    case "extract": return Database;
  }
}

function createStep(kind: StepKind, index: number): WorkflowStep {
  const defaults: Record<StepKind, { title: string; description: string; value: string }> = {
    navigate: { title: "Navigate to page", description: "Load a page in the browser", value: "https://" },
    click: { title: "Click element", description: "Click a page element", value: "button.submit" },
    type: { title: "Type into field", description: "Enter text into an input", value: "Text to enter" },
    wait: { title: "Wait for page", description: "Pause before the next action", value: "1000" },
    extract: { title: "Extract data", description: "Capture data from the page", value: "title" }
  };
  return { id: `step-${Date.now()}-${index}`, kind, ...defaults[kind], enabled: true };
}

export default function App() {
  const [workflow, setWorkflow] = useState<Workflow>(starter);
  const [selectedId, setSelectedId] = useState(starter.steps[0].id);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"steps" | "data">("steps");
  const [running, setRunning] = useState(false);
  const [runState, setRunState] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("Ready to run");
  const [browserStatus, setBrowserStatus] = useState<"unknown" | "connected" | "offline">("unknown");
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  const selected = workflow.steps.find(step => step.id === selectedId) ?? workflow.steps[0];
  const filteredSteps = useMemo(() => workflow.steps.filter(s =>
    `${s.title} ${s.description} ${s.kind}`.toLowerCase().includes(query.toLowerCase())
  ), [workflow.steps, query]);

  function updateSelected(patch: Partial<WorkflowStep>) {
    if (!selected) return;
    setWorkflow(current => ({ ...current, steps: current.steps.map(step => step.id === selected.id ? { ...step, ...patch } : step) }));
  }

  function addStep(kind: StepKind) {
    const next = createStep(kind, workflow.steps.length + 1);
    setWorkflow(current => ({ ...current, steps: [...current.steps, next] }));
    setSelectedId(next.id);
    setRunState("idle");
    setMessage(`${stepLabels[kind]} added`);
  }

  function removeSelected() {
    if (!selected) return;
    const nextSteps = workflow.steps.filter(step => step.id !== selected.id);
    setWorkflow(current => ({ ...current, steps: nextSteps }));
    setSelectedId(nextSteps[0]?.id ?? "");
    setMessage("Step removed");
  }

  function moveSelected(direction: -1 | 1) {
    const index = workflow.steps.findIndex(step => step.id === selectedId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= workflow.steps.length) return;
    setWorkflow(current => {
      const steps = [...current.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
  }

  async function runWorkflow() {
    setRunning(true);
    setRunState("idle");
    setMessage("Starting workflow…");
    try {
      await backend.runWorkflow(workflow);
      setRunState("success");
      setMessage("Workflow completed");
    } catch (error) {
      setRunState("error");
      setMessage(error instanceof Error ? error.message : "Could not run workflow");
    } finally {
      setRunning(false);
    }
  }

  async function connectBrowser() {
    setMessage("Looking for browsers…");
    try {
      await backend.listBrowsers();
      setBrowserStatus("connected");
      setMessage("Browser discovery complete");
    } catch (error) {
      setBrowserStatus("offline");
      setMessage(error instanceof Error ? error.message : "Browser discovery failed");
    }
  }

  const Icon = selected ? iconFor(selected.kind) : WorkflowIcon;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><WorkflowIcon size={18} strokeWidth={2.2} /></div>
          <span className="brand-name">cobweb</span><span className="brand-divider" />
          <span className="workspace-name">Automation studio</span>
        </div>
        <div className="topbar-center"><span className="save-dot" /> All changes saved</div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Help"><CircleHelp size={16} /></button>
          <button className="icon-button" aria-label="Settings"><Settings2 size={16} /></button>
          <div className="avatar">CW</div>
        </div>
      </header>

      <div className="projectbar">
        <div className="project-title">
          <span className="eyebrow">WORKFLOWS /</span>
          <input aria-label="Workflow name" className="workflow-name" value={workflow.name} onChange={e => setWorkflow(w => ({ ...w, name: e.target.value }))} />
          <ChevronDown size={14} className="muted-icon" />
        </div>
        <div className="project-actions">
          <button className="secondary-button" onClick={() => { setWorkflow(starter); setSelectedId(starter.steps[0].id); setMessage("Starter workflow restored"); }}><RefreshCw size={14} /> Reset</button>
          <button className="secondary-button" onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(workflow, null, 2)); setMessage("Workflow JSON copied"); }}><Copy size={14} /> Export JSON</button>
          <button className="run-button" onClick={() => void runWorkflow()} disabled={running || workflow.steps.length === 0}>
            {running ? <Square size={14} /> : <Play size={14} fill="currentColor" />} {running ? "Running" : "Run workflow"} <span className="shortcut">⌘ ↵</span>
          </button>
        </div>
      </div>

      <main className={`workspace ${!showPalette ? "no-palette" : ""} ${!showInspector ? "no-inspector" : ""}`}>
        {showPalette && <aside className="left-panel">
          <div className="panel-heading"><span>BUILD</span><button className="icon-button small" aria-label="Hide step library" onClick={() => setShowPalette(false)}><PanelLeftClose size={15} /></button></div>
          <div className="search-wrap"><Search size={14} /><input aria-label="Search steps" placeholder="Find a step..." value={query} onChange={e => setQuery(e.target.value)} /><kbd>/</kbd></div>
          <div className="section-label">STEP LIBRARY <span>{palette.length}</span></div>
          <div className="palette-list">
            {palette.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())).map(item => {
              const ItemIcon = item.icon;
              return <button className="palette-item" key={item.kind} onClick={() => addStep(item.kind)}>
                <span className="palette-icon"><ItemIcon size={16} /></span><span className="palette-copy"><strong>{item.title}</strong><small>{item.description}</small></span><Plus size={14} className="palette-plus" />
              </button>;
            })}
          </div>
          <div className="left-bottom">
            <div className="tip-icon"><Zap size={15} /></div><div><strong>Build faster</strong><p>Add steps from the library, then configure them in the inspector.</p></div>
          </div>
        </aside>}

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="canvas-breadcrumb"><Layers3 size={14} /><span>Workflow</span><span className="crumb-sep">/</span><span className="muted">Editor</span></div>
            <div className="canvas-tools">
              {!showPalette && <button className="icon-button small" aria-label="Show step library" onClick={() => setShowPalette(true)}><PanelLeftClose size={15} /></button>}
              <span className="canvas-count">{workflow.steps.length} steps</span>
              <button className="icon-button small" aria-label="Toggle inspector" onClick={() => setShowInspector(v => !v)}><ListFilter size={15} /></button>
              <button className="icon-button small" aria-label="More workflow actions"><MoreHorizontal size={16} /></button>
            </div>
          </div>
          <div className="canvas-scroll">
            <div className="flow-heading"><div><div className="flow-kicker">AUTOMATION FLOW</div><h1>{workflow.name || "Untitled workflow"}</h1><p>Configure each step, then run it against your browser session.</p></div><span className={`run-state ${runState}`}><span />{runState === "success" ? "Completed" : runState === "error" ? "Needs attention" : "Draft"}</span></div>
            <div className="flow-track">
              <div className="start-node"><span className="start-icon"><Play size={13} fill="currentColor" /></span><div><strong>Workflow start</strong><small>Execution entry point</small></div><span className="node-tag">TRIGGER</span></div>
              <div className="connector"><span /></div>
              {filteredSteps.map((step, index) => {
                const StepIcon = iconFor(step.kind);
                const actualIndex = workflow.steps.findIndex(s => s.id === step.id);
                return <div className="flow-item-wrap" key={step.id}>
                  <button className={`flow-node ${selectedId === step.id ? "selected" : ""} ${!step.enabled ? "disabled" : ""}`} onClick={() => setSelectedId(step.id)}>
                    <div className={`node-icon ${step.kind}`}><StepIcon size={17} /></div>
                    <div className="node-content"><div className="node-topline"><span>STEP {String(actualIndex + 1).padStart(2, "0")}</span><span className="node-kind">{stepLabels[step.kind]}</span></div><strong>{step.title}</strong><p>{step.value || step.description}</p></div>
                    <div className="node-side"><span className={`enabled-indicator ${step.enabled ? "on" : ""}`} /><GripVertical size={15} /></div>
                  </button>
                  <div className="flow-inline-actions">
                    <button aria-label={`Move ${step.title} up`} disabled={actualIndex === 0} onClick={() => moveSelectedFor(step.id, -1, workflow, setWorkflow, setSelectedId)}><ArrowUp size={12} /></button>
                    <button aria-label={`Move ${step.title} down`} disabled={actualIndex === workflow.steps.length - 1} onClick={() => moveSelectedFor(step.id, 1, workflow, setWorkflow, setSelectedId)}><ArrowDown size={12} /></button>
                  </div>
                  {index < filteredSteps.length - 1 && <div className="connector"><span /></div>}
                </div>;
              })}
              <button className="add-node" onClick={() => setShowPalette(true)}><Plus size={14} /><span>Add next step</span></button>
              <div className="end-node"><span className="end-icon"><Check size={13} /></span><div><strong>Workflow complete</strong><small>End of execution</small></div></div>
            </div>
          </div>
          <footer className="statusbar"><div className="status-left"><span className={`status-led ${runState}`} /><span>{message}</span></div><div className="status-right"><span><Code2 size={12} /> JSON workflow</span><span><Command size={12} /> Local-first</span></div></footer>
        </section>

        {showInspector && <aside className="right-panel">
          <div className="inspector-heading"><div><span className="eyebrow">CONFIGURATION</span><h2>Inspector</h2></div><button className="icon-button small" aria-label="Close inspector" onClick={() => setShowInspector(false)}><X size={15} /></button></div>
          <div className="inspector-tabs"><button className={activeTab === "steps" ? "active" : ""} onClick={() => setActiveTab("steps")}>Step settings</button><button className={activeTab === "data" ? "active" : ""} onClick={() => setActiveTab("data")}>Data <span className="tab-count">0</span></button></div>
          {activeTab === "steps" ? (selected ? <div className="inspector-body">
            <div className="selected-step-header"><div className={`node-icon large ${selected.kind}`}><Icon size={18} /></div><div><span className="eyebrow">STEP CONFIGURATION</span><h3>{stepLabels[selected.kind]}</h3></div></div>
            <label className="field-label" htmlFor="step-title">Step name</label>
            <input id="step-title" className="field-input" value={selected.title} onChange={e => updateSelected({ title: e.target.value })} />
            <label className="field-label" htmlFor="step-kind">Action type</label>
            <div className="select-shell"><select id="step-kind" value={selected.kind} onChange={e => updateSelected({ kind: e.target.value as StepKind })}>{palette.map(item => <option key={item.kind} value={item.kind}>{item.title}</option>)}</select><ChevronDown size={14} /></div>
            <label className="field-label" htmlFor="step-value">{selected.kind === "navigate" ? "Target URL" : selected.kind === "wait" ? "Delay (milliseconds)" : selected.kind === "extract" ? "Fields to extract" : selected.kind === "type" ? "Text to enter" : "CSS selector"}</label>
            <textarea id="step-value" className="field-input field-textarea" rows={3} value={selected.value} onChange={e => updateSelected({ value: e.target.value })} />
            <p className="field-hint">{selected.description}</p>
            <div className="toggle-row"><div><strong>Enabled</strong><small>Include this step during execution</small></div><button role="switch" aria-checked={selected.enabled} aria-label="Enable step" className={`toggle ${selected.enabled ? "on" : ""}`} onClick={() => updateSelected({ enabled: !selected.enabled })}><span /></button></div>
            <div className="inspector-divider" />
            <div className="field-label">Step actions</div>
            <div className="action-grid"><button onClick={() => moveSelected(-1)} disabled={workflow.steps.findIndex(s => s.id === selected.id) === 0}><ArrowUp size={14} /> Move up</button><button onClick={() => moveSelected(1)} disabled={workflow.steps.findIndex(s => s.id === selected.id) === workflow.steps.length - 1}><ArrowDown size={14} /> Move down</button></div>
            <button className="delete-button" onClick={removeSelected}><Trash2 size={14} /> Delete step</button>
          </div> : <div className="empty-inspector"><WorkflowIcon size={22} /><strong>No step selected</strong><p>Add a step to start building your workflow.</p></div>) : <div className="data-empty"><div className="data-icon"><Braces size={20} /></div><strong>No output data yet</strong><p>Run a workflow with an Extract data step to see captured values here.</p><button className="secondary-button" onClick={() => setActiveTab("steps")}>Back to steps</button></div>}
          <div className="browser-card">
            <div className="browser-card-head"><div className="browser-symbol"><Globe2 size={15} /></div><div><strong>Browser session</strong><small>Local browser runtime</small></div><span className={`connection-dot ${browserStatus}`} /></div>
            <div className="browser-card-status"><span>{browserStatus === "connected" ? "Discovery complete" : browserStatus === "offline" ? "Not connected" : "Not connected"}</span><span className="browser-status-pill">{browserStatus === "connected" ? "READY" : "IDLE"}</span></div>
            <button className="connect-button" onClick={() => void connectBrowser()}><Radio size={14} /> Discover browsers</button>
          </div>
        </aside>}
      </main>
      <div className="bottom-hint"><span><Terminal size={12} /> {message}</span><span>COBWEB DESKTOP <i /> PHASE 2 UI</span></div>
    </div>
  );
}

function moveSelectedFor(
  id: string, direction: -1 | 1, workflow: Workflow,
  setWorkflow: (next: Workflow | ((current: Workflow) => Workflow)) => void,
  setSelectedId: (id: string) => void
) {
  const index = workflow.steps.findIndex(step => step.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= workflow.steps.length) return;
  setWorkflow(current => {
    const steps = [...current.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    return { ...current, steps };
  });
  setSelectedId(id);
}
