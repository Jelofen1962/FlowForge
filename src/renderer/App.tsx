import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { addEdge, Background, BackgroundVariant, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Braces, Bug, Check, ChevronDown, CircleHelp, Clock3, Code2, Command, FileJson, FolderOpen, GitBranch, Globe2, Image, Layers3, ListTree, Moon, MousePointer2, Play, Plus, Puzzle, Save, Search, Settings2, ShieldCheck, Sparkles, Square, Sun, Workflow, X } from 'lucide-react';
import { detectJsonFields, parseJson } from '../data/jsonFields';
import { parseCsv, parseTextLines, stringifyCsv } from '../data/formats';
import { createDefaultRegistry, executeWorkflow, type RunResult } from '../workflow/engine';
import { validateWorkflow, type Workflow, type WorkflowNode } from '../workflow/schema';
import type { ElementSnapshot } from '../automation/chromeSession';

type FlowNodeData = { label: string; kind: string; description: string; config: Record<string, unknown>; status?: string };
type FlowNode = Node<FlowNodeData>;
const nodeMeta: Record<string, { label: string; description: string; icon: typeof Globe2; tint: string }> = {
  start: { label: 'Start', description: 'Entry point for this workflow.', icon: Play, tint: 'violet' },
  openUrl: { label: 'Open URL', description: 'Navigate the managed Chrome session to a URL.', icon: Globe2, tint: 'blue' },
  click: { label: 'Click element', description: 'Click a matching element in the managed browser.', icon: MousePointer2, tint: 'blue' },
  typeText: { label: 'Type text', description: 'Enter text into a matching input.', icon: Code2, tint: 'blue' },
  waitForElement: { label: 'Wait for element', description: 'Wait until a matching element is present.', icon: Clock3, tint: 'slate' },
  readAttribute: { label: 'Read attribute', description: 'Read visible text or an attribute from an element.', icon: Code2, tint: 'cyan' },
  extractText: { label: 'Extract text', description: 'Read visible text from a matching page element.', icon: Code2, tint: 'cyan' },
  extractLinks: { label: 'Extract links', description: 'Collect links from a page or selected container.', icon: ArrowDownToLine, tint: 'cyan' },
  setVariable: { label: 'Set variable', description: 'Assign a value to a workflow variable.', icon: Braces, tint: 'amber' },
  forEach: { label: 'For each item', description: 'Iterate over a bounded collection.', icon: GitBranch, tint: 'orange' },
  if: { label: 'Condition', description: 'Route execution based on a condition.', icon: GitBranch, tint: 'orange' },
  writeFile: { label: 'Save output', description: 'Write data to a selected output file.', icon: Save, tint: 'green' },
  log: { label: 'Log message', description: 'Write a message to the execution console.', icon: Activity, tint: 'slate' },
  subworkflow: { label: 'Run workflow', description: 'Call a reusable workflow from the library.', icon: Puzzle, tint: 'violet' },
};
const initialNodes: FlowNode[] = [
  { id: 'start', type: 'flowNode', position: { x: 110, y: 90 }, data: { label: 'Start', kind: 'start', description: 'Entry point for this workflow.', config: {} } },
  { id: 'open', type: 'flowNode', position: { x: 110, y: 260 }, data: { label: 'Open URL', kind: 'openUrl', description: nodeMeta.openUrl.description, config: { url: 'https://example.com' } } },
  { id: 'extract', type: 'flowNode', position: { x: 110, y: 430 }, data: { label: 'Extract text', kind: 'extractText', description: nodeMeta.extractText.description, config: { selector: 'h1', outputVariable: 'pageTitle' } } },
];
const initialEdges: Edge[] = [
  { id: 'e-start-open', source: 'start', target: 'open', animated: true, style: { stroke: '#6d82ff', strokeWidth: 1.6 } },
  { id: 'e-open-extract', source: 'open', target: 'extract', animated: true, style: { stroke: '#6d82ff', strokeWidth: 1.6 } },
];
function previewOutput(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 180);
  try { return (JSON.stringify(value) ?? String(value)).slice(0, 180); }
  catch { return String(value).slice(0, 180); }
}

const modes = ['Workflow Builder', 'Web Scraping', 'Task Automation', 'Recorder', 'Data Processing', 'Runs / History'];
const implementedActions = new Set(['start', 'openUrl', 'click', 'typeText', 'waitForElement', 'readAttribute', 'extractText', 'extractLinks', 'setVariable', 'writeFile', 'log']);

function FlowNodeCard({ data, selected }: NodeProps<FlowNode>) {
  const meta = nodeMeta[data.kind] ?? nodeMeta.log;
  const Icon = meta.icon;
  return <div className={`flow-node ${selected ? 'selected' : ''}`}>
    <div className={`node-icon ${meta.tint}`}><Icon size={16} /></div>
    <div className="node-copy"><strong>{data.label}</strong><span>{data.description}</span></div>
    <span className={`node-state ${data.status ?? ''}`} />
    <div className="node-port target" /><div className="node-port source" />
  </div>;
}
const nodeTypes = { flowNode: FlowNodeCard };

function App() {
  const reducedMotion = useReducedMotion();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string>('open');
  const [mode, setMode] = useState(modes[0]);
  const [dark, setDark] = useState(true);
  const [leftTab, setLeftTab] = useState('Actions');
  const [query, setQuery] = useState('');
  const [run, setRun] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('Ready to build');
  const [workflowName, setWorkflowName] = useState('Product research');
  const [workflowId, setWorkflowId] = useState('workflow-product-research');
  const [jsonInput, setJsonInput] = useState('[\n  { "id": 1, "url": "https://example.com", "product": { "name": "Sample item", "price": 19.99 } },\n  { "id": 2, "url": "https://example.org", "product": { "name": "Another item", "price": 24.5 } }\n]');
  const [showJson, setShowJson] = useState(false);
  const [inputFilePath, setInputFilePath] = useState('');
  const [inputFormat, setInputFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [outputFormat, setOutputFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [browserUrl, setBrowserUrl] = useState('https://example.com');
  const [browserReady, setBrowserReady] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementSnapshot | null>(null);
  const [locatorStrategy, setLocatorStrategy] = useState('css');
  const [locatorValue, setLocatorValue] = useState('');
  const [locatorResult, setLocatorResult] = useState<string>('');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [fieldResults, setFieldResults] = useState<ReturnType<typeof detectJsonFields>>([]);
  const selectedNode = nodes.find((node) => node.id === selectedId) as FlowNode | undefined;
  const filteredActions = Object.entries(nodeMeta).filter(([, meta]) => meta.label.toLowerCase().includes(query.toLowerCase()));
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: '#6d82ff', strokeWidth: 1.6 } }, eds)), [setEdges]);
  const workflow = useMemo<Workflow>(() => ({
    schemaVersion: 1, id: workflowId, name: workflowName,
    nodes: nodes.map((node) => ({ id: node.id, type: node.data.kind as WorkflowNode['type'], label: node.data.label, position: node.position, config: node.data.config ?? {}, disabled: false })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}), ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}) })),
    variables: [{ name: 'startUrl', type: 'string', value: 'https://example.com', scope: 'workflow' }],
  }), [nodes, edges, workflowName, workflowId]);
  const addNode = (kind: string) => {
    const meta = nodeMeta[kind];
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const node: FlowNode = { id, type: 'flowNode', position: { x: 380 + Math.random() * 60, y: 120 + nodes.length * 95 }, data: { label: meta.label, kind, description: meta.description, config: kind === 'openUrl' ? { url: '{{variables.startUrl}}' } : ['extractText', 'click', 'typeText', 'waitForElement', 'readAttribute'].includes(kind) ? { selector: 'h1', strategy: 'css', ...(kind === 'extractText' ? { outputVariable: 'pageTitle' } : {}), ...(kind === 'typeText' ? { text: '', clear: true } : {}), ...(kind === 'waitForElement' ? { timeoutMs: 10000 } : {}), ...(kind === 'readAttribute' ? { attribute: 'textContent', outputVariable: 'result' } : {}) } : kind === 'extractLinks' ? { selector: 'a[href]', outputVariable: 'links' } : kind === 'setVariable' ? { name: 'result', value: '' } : kind === 'log' ? { message: 'Workflow step completed' } : kind === 'writeFile' ? { filename: 'output.json', content: '{{variables.result}}' } : kind === 'forEach' ? { items: '{{variables.items}}', maxItems: 1000 } : {} } };
    setNodes((current) => [...current, node]);
    setSelectedId(id);
    setNotice(`${meta.label} added to canvas`);
  };
  const updateConfig = (key: string, value: unknown) => {
    if (!selectedNode) return;
    setNodes((current) => current.map((node) => node.id === selectedNode.id ? { ...node, data: { ...node.data, config: { ...node.data.config, [key]: value } } } : node));
  };
  const saveWorkflow = async () => {
    const validation = validateWorkflow(workflow);
    if (validation.errors.length) { setNotice(`Validation failed: ${validation.errors[0]}`); return; }
    if (!window.flowforge) { setNotice('Browser preview: workflow validated, but desktop save requires Electron.'); return; }
    const result = await window.flowforge.saveWorkflow(workflow);
    setNotice(result.ok ? `Saved to ${result.path}` : result.error ?? 'Save failed');
  };
  const openWorkflow = async () => {
    if (!window.flowforge) { setNotice('Open workflow is available in the desktop app.'); return; }
    try {
      const input = await window.flowforge.loadWorkflow() as Workflow | null;
      if (!input) return;
      const validation = validateWorkflow(input);
      if (!validation.workflow) { setNotice(validation.errors[0] ?? 'Invalid workflow'); return; }
      setWorkflowId(input.id); setWorkflowName(input.name);
      setNodes(input.nodes.map((node) => ({ id: node.id, type: 'flowNode', position: node.position, data: { label: node.label, kind: node.type, description: nodeMeta[node.type]?.description ?? '', config: node.config } })));
      setEdges(input.edges.map((edge) => ({ ...edge, animated: true, style: { stroke: '#6d82ff', strokeWidth: 1.6 } })));
      setNotice('Workflow loaded');
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };
  const execute = async () => {
    const validation = validateWorkflow(workflow);
    if (validation.errors.length) { setNotice(validation.errors[0]); return; }
    setRunning(true); setNotice('Executing workflow…');
    const runId = `run_${Date.now()}`; setActiveRunId(runId);
    let result: RunResult;
    try {
      result = window.flowforge ? await window.flowforge.runWorkflow(workflow, runId) : await executeWorkflow(workflow, createDefaultRegistry(), { maxSteps: 1000 });
    } catch (error) {
      result = { status: 'failed', steps: [], variables: {}, logs: [], error: error instanceof Error ? error.message : String(error) };
    }
    setRun(result); setRunning(false); setActiveRunId(null);
    if (window.flowforge) { try { setBrowserReady(await window.flowforge.browser.status()); } catch { /* the run result remains authoritative */ } }
    setNotice(result.status === 'succeeded' ? `Run completed · ${result.steps.length} steps` : `${result.status}: ${result.error ?? 'Run stopped'}`);
  };
  const startBrowser = async () => {
    if (!window.flowforge) { setNotice('Managed Chrome requires the Electron desktop app.'); return; }
    setNotice('Starting managed Chrome…');
    const result = await window.flowforge.browser.start();
    setBrowserReady(result.ok); setNotice(result.ok ? 'Chrome session ready' : result.error ?? 'Could not start Chrome');
  };
  const stopBrowser = async () => {
    if (!window.flowforge) return;
    const result = await window.flowforge.browser.stop();
    setBrowserReady(false); setSelectedElement(null); setNotice(result.ok ? 'Chrome session stopped' : result.error ?? 'Could not stop Chrome');
  };
  const navigateBrowser = async () => {
    if (!window.flowforge) { setNotice('Managed Chrome requires the Electron desktop app.'); return; }
    const result = await window.flowforge.browser.navigate(browserUrl);
    if (result.ok) { setBrowserUrl(result.url ?? browserUrl); setNotice(`Loaded ${result.title || result.url}`); }
    else setNotice(result.error ?? 'Navigation failed');
  };
  const pickElement = async () => {
    if (window.flowforge && !browserReady) { setNotice('Launch the managed Chrome session first.'); return; }
    if (!window.flowforge) { setNotice('Element selection requires the Electron desktop app.'); return; }
    setNotice('Move to an element in Chrome and Alt+click it. Press Escape to cancel.');
    const result = await window.flowforge.browser.selectElement();
    if (!result.ok || !result.element) { setNotice(result.error ?? 'Element selection failed'); return; }
    setSelectedElement(result.element);
    const preferred = result.element.selectors.find((selector) => selector.strategy === 'id' && selector.matches === 1) ?? result.element.selectors.find((selector) => selector.strategy === 'css' && selector.matches === 1) ?? result.element.selectors[0];
    setLocatorStrategy(preferred.strategy); setLocatorValue(preferred.value); setLocatorResult(`${preferred.matches} match(es)`); setNotice(`Selected <${result.element.tagName}>`);
  };
  const addSelectedElementAction = () => {
    if (!selectedElement) return;
    const id = `click-${Math.random().toString(36).slice(2, 7)}`;
    const node: FlowNode = { id, type: 'flowNode', position: { x: (selectedNode?.position.x ?? 110), y: Math.max(...nodes.map((item) => item.position.y), 0) + 150 }, data: { label: `Click ${selectedElement.tagName}`, kind: 'click', description: nodeMeta.click.description, config: { selector: locatorValue, strategy: locatorStrategy } } };
    setNodes((current) => [...current, node]);
    if (selectedNode) setEdges((current) => {
      const downstream = current.filter((edge) => edge.source === selectedNode.id);
      const remaining = current.filter((edge) => edge.source !== selectedNode.id);
      const link = { id: `e-${selectedNode.id}-${id}`, source: selectedNode.id, target: id, animated: true, style: { stroke: '#6d82ff', strokeWidth: 1.6 } };
      return [...remaining, link, ...downstream.map((edge) => ({ ...edge, source: id, sourceHandle: undefined }))];
    });
    setSelectedId(id); setNotice('Selected element added as an editable Click element node');
  };
  const testLocator = async () => {
    if (!window.flowforge) { setLocatorResult('Desktop app required'); return; }
    const result = await window.flowforge.browser.testLocator(locatorStrategy, locatorValue);
    setLocatorResult(result.ok ? `${result.matches} match(es)${result.firstText ? ` · “${result.firstText.slice(0, 60)}”` : ''}` : result.error ?? 'Locator test failed');
  };
  const inspectJson = () => {
    try {
      const parsed = inputFormat === 'json' ? parseJson(jsonInput) : inputFormat === 'csv' ? parseCsv(jsonInput) : parseTextLines(jsonInput);
      setFieldResults(detectJsonFields(parsed)); setNotice(`${inputFormat.toUpperCase()} fields detected`);
    } catch (error) { setFieldResults([]); setNotice(error instanceof Error ? error.message : String(error)); }
  };
  const loadInputFile = async () => {
    if (!window.flowforge) { setNotice('File picking requires the Electron desktop app.'); return; }
    try {
      const file = await window.flowforge.chooseInputFile();
      if (!file) return;
      const extension = file.path.split('.').pop()?.toLowerCase();
      const format = extension === 'csv' ? 'csv' : extension === 'txt' ? 'txt' : 'json';
      setInputFilePath(file.path); setInputFormat(format); setJsonInput(file.content); setFieldResults([]); setShowJson(true); setMode('Data Processing');
      setNotice(`Loaded ${file.path}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };
  const saveFieldResults = async () => {
    if (!window.flowforge) { setNotice('Saving output requires the Electron desktop app.'); return; }
    const report = { source: inputFilePath || 'pasted input', format: inputFormat, fields: fieldResults };
    const content = outputFormat === 'json' ? JSON.stringify(report, null, 2) : outputFormat === 'csv' ? stringifyCsv(fieldResults) : [`Source: ${report.source}`, `Input format: ${inputFormat}`, '', ...fieldResults.map((field) => `${field.path}\t${field.types.join('|')}\t${field.present}/${field.total}`)].join('\n');
    const result = await window.flowforge.writeOutput(`field-detection.${outputFormat}`, content);
    setNotice(result.ok ? `Saved field report to ${result.path}` : result.error ?? 'Could not save field report');
  };

  return <div className={`app-shell ${dark ? 'theme-dark' : 'theme-light'}`}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Workflow size={19} /></div><span>flowforge</span><span className="brand-beta">STUDIO</span></div>
      <div className="topbar-divider" />
      <button className="project-switch" disabled title="Multi-project switching is not implemented yet"><Layers3 size={15} /><span>Workspace</span><ChevronDown size={13} /></button>
      <div className="breadcrumb"><span>Workflows</span><span className="crumb-slash">/</span><input aria-label="Workflow name" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} /></div>
      <div className="topbar-spacer" />
      <div className="saved-state"><span className="status-dot" /> Manual save</div>
      <button className="icon-button" title="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
      <button className="icon-button" title="Help" onClick={() => setNotice('FlowForge help: add actions, connect ports, configure nodes, then validate and run.')}><CircleHelp size={16} /></button>
      <button className="button-secondary" onClick={() => { setNodes([{ id: 'start', type: 'flowNode', position: { x: 110, y: 90 }, data: { label: 'Start', kind: 'start', description: nodeMeta.start.description, config: {} } }]); setEdges([]); setSelectedId('start'); setWorkflowId(`workflow-${Date.now()}`); setWorkflowName('Untitled workflow'); setRun(null); setNotice('New workflow ready'); }}><Plus size={15}/> New</button>
      <button className="button-secondary" onClick={openWorkflow}><FolderOpen size={15} /> Open</button>
      <button className="button-primary" onClick={saveWorkflow}><Save size={15} /> Save workflow</button>
    </header>

    <div className="modebar"><div className="mode-tabs">{modes.map((item, index) => <button key={item} className={`mode-tab ${mode === item ? 'active' : ''}`} onClick={() => { setMode(item); if (item === 'Data Processing') setShowJson(true); if (item === 'Runs / History') setLeftTab('Runs'); if (item === 'Task Automation') setNotice('Task scheduling is not implemented yet. You can build and run workflows here.'); if (item === 'Web Scraping') setNotice('Use the managed browser controls to navigate and select elements; guided scraping schemas are still in progress.'); }}><span className="mode-glyph">{[<Workflow size={14}/>, <Globe2 size={14}/>, <Command size={14}/>, <MousePointer2 size={14}/>, <Braces size={14}/>, <Clock3 size={14}/>][index]}</span>{item}</button>)}</div><div className="modebar-right"><span className="local-badge"><ShieldCheck size={13} /> Local workspace</span><span className="kbd-hint">⌘ K</span></div></div>

    <main className="workspace">
      <aside className="left-panel">
        <div className="panel-tabs">{['Actions', 'Variables', 'Library', 'Runs'].map((tab) => <button key={tab} className={leftTab === tab ? 'selected' : ''} onClick={() => setLeftTab(tab)}>{tab}</button>)}</div>
        {leftTab === 'Actions' && <><div className="panel-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an action…" aria-label="Find an action"/><span>/</span></div><div className="action-section-label">BUILDING BLOCKS <span>{filteredActions.length}</span></div><div className="action-list">{filteredActions.map(([kind, meta]) => { const Icon = meta.icon; const unavailable = !implementedActions.has(kind) || kind === 'start'; return <button key={kind} className={`action-row ${unavailable ? 'unavailable' : ''}`} disabled={unavailable} title={kind === 'start' ? 'The workflow already has a start node' : unavailable ? 'This action is not implemented yet' : meta.description} onClick={() => addNode(kind)}><span className={`action-icon ${meta.tint}`}><Icon size={15}/></span><span className="action-label">{meta.label}<small>{kind === 'start' ? 'Entry point already exists' : unavailable ? 'Not implemented yet' : meta.description}</small></span>{unavailable ? <span className="coming-tag">Planned</span> : <Plus size={14} className="action-plus"/>}</button>; })}</div><div className="left-panel-bottom"><div className="tip-card"><Sparkles size={15}/><div><strong>Build faster</strong><p>Connect actions to create a reusable automation.</p></div></div><button className="text-link" disabled title="Integration catalog is not implemented yet"><Puzzle size={14}/> Integrations (planned)</button></div></>}
        {leftTab === 'Variables' && <div className="side-content"><div className="section-heading">WORKFLOW VARIABLES <button disabled title="Variable creation is not implemented yet"><Plus size={14}/></button></div><div className="variable-card"><Braces size={15}/><div><strong>startUrl</strong><small>string · workflow</small><code>https://example.com</code></div></div><div className="variable-card"><Braces size={15}/><div><strong>pageTitle</strong><small>string · run output</small><code>steps.extract.output</code></div></div><p className="muted-note">Expressions use <code>{'{{variables.name}}'}</code> syntax.</p></div>}
        {leftTab === 'Library' && <div className="side-content"><div className="section-heading">REUSABLE WORKFLOWS <button disabled title="Reusable workflow library is not implemented yet"><Plus size={14}/></button></div><div className="empty-library"><Puzzle size={22}/><strong>Your library starts here</strong><p>Reusable workflows and dependency links will appear here as you save them.</p></div></div>}
        {leftTab === 'Runs' && <div className="side-content"><div className="section-heading">RECENT RUNS</div>{run ? <div className="run-history"><span className={`run-indicator ${run.status}`}/><div><strong>{workflowName}</strong><small>{run.status} · {run.steps.length} steps</small></div></div> : <div className="empty-library"><Clock3 size={22}/><strong>No runs yet</strong><p>Execute a workflow to see its results and step history.</p></div>}</div>}
      </aside>

      <section className="editor-area">
        <div className="editor-toolbar"><div className="editor-title"><span className="canvas-icon"><Workflow size={16}/></span><div><strong>Workflow canvas</strong><small>{nodes.length} nodes <span>·</span> {edges.length} connections</small></div></div><div className="toolbar-actions"><button className="toolbar-button" onClick={() => { setNodes(initialNodes); setEdges(initialEdges); setNotice('Canvas reset to example workflow'); }}><ArrowDownToLine size={14}/> Reset example</button><span className="toolbar-separator"/><button className="icon-button subtle" title="Minimap is visible in canvas" onClick={() => setNotice('Use the minimap to navigate larger workflows.')}><ListTree size={15}/></button><button className="icon-button subtle" title="Step debugging is not implemented yet" disabled><Bug size={15}/></button><button className="icon-button subtle" title="Additional canvas settings are not implemented yet" disabled><Settings2 size={15}/></button></div></div>
        {(mode === 'Recorder' || mode === 'Web Scraping') && <div className="browser-toolbar"><div className="browser-toolbar-title"><span className={`browser-live-dot ${browserReady ? 'on' : ''}`}/><strong>Managed Chrome</strong><small>{browserReady ? 'Session connected' : 'Session stopped'}</small></div><input aria-label="Browser URL" value={browserUrl} onChange={(event) => setBrowserUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void navigateBrowser(); }} placeholder="https://example.com"/><button className="button-secondary small" onClick={startBrowser} disabled={browserReady}><Play size={13}/> Launch</button><button className="button-secondary small" onClick={navigateBrowser} disabled={!browserReady}><Globe2 size={13}/> Go</button><button className="button-primary small" onClick={pickElement} disabled={!browserReady}><MousePointer2 size={13}/> Alt+click picker</button><button className="icon-button" title="Stop Chrome" onClick={stopBrowser} disabled={!browserReady}><Square size={13}/></button></div>}
        <div className="canvas-wrap"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_event, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId('')} fitView minZoom={0.25} maxZoom={1.5} defaultEdgeOptions={{ animated: true }} proOptions={{ hideAttribution: true }}><Background color={dark ? '#252b3b' : '#dce1ec'} gap={23} size={1} variant={BackgroundVariant.Dots}/><Controls position="bottom-left" showInteractive={false}/><MiniMap position="bottom-right" nodeColor={(node) => ({ start: '#8b7cff', openUrl: '#6d82ff', extractText: '#43b7c5', extractLinks: '#43b7c5', setVariable: '#e8b45e', forEach: '#f08c52', if: '#f08c52', writeFile: '#4bbd8b', log: '#8b97aa', subworkflow: '#8b7cff' }[String((node.data as FlowNodeData).kind)] ?? '#6d82ff')} maskColor={dark ? 'rgba(10,13,20,.65)' : 'rgba(235,239,247,.65)'}/></ReactFlow><button className="canvas-add" onClick={() => addNode('log')}><Plus size={15}/> Add node</button><div className="canvas-hint"><span className="hint-key">Drag</span> to move <span className="hint-dot"/> <span className="hint-key">Connect</span> node ports</div></div>
        <div className="runbar"><div className="runbar-left"><span className={`run-light ${running ? 'active' : ''}`}/><span>{notice}</span></div><div className="runbar-right"><button className="button-secondary small" onClick={() => { const validation = validateWorkflow(workflow); setNotice(validation.errors.length ? validation.errors[0] : 'Graph validation passed'); }}><ShieldCheck size={14}/> Validate</button><button className="button-primary run-button" disabled={running} onClick={execute}>{running ? <Activity size={14} className="spin"/> : <Play size={14} fill="currentColor"/>}{running ? 'Running…' : 'Run workflow'}</button><button className="icon-button" title="Stop run" disabled={!running} onClick={async () => { if (activeRunId && window.flowforge) { const cancelled = await window.flowforge.cancelWorkflow(activeRunId); setNotice(cancelled ? 'Cancellation requested' : 'Run is already finishing'); } }}><Square size={14}/></button></div></div>
        {run && <div className="execution-panel"><div className="execution-head"><div><Activity size={15}/><strong>Latest execution</strong><span className={`run-tag ${run.status}`}>{run.status}</span></div><button className="icon-button subtle" onClick={() => setRun(null)}><X size={14}/></button></div><div className="execution-steps">{run.steps.map((step) => <div className="execution-step" key={step.nodeId}><span className={`step-check ${step.status}`}>{step.status === 'succeeded' ? <Check size={12}/> : <X size={12}/>}</span><strong>{nodes.find((node) => node.id === step.nodeId)?.data.label ?? step.nodeId}</strong><span>{step.durationMs} ms</span>{step.error && <code className="step-error">{step.error}</code>}{step.output !== undefined && <code className="step-output">{previewOutput(step.output)}</code>}</div>)}</div>{run.error && <p className="error-text">{run.error}</p>}{run.logs.length > 0 && <div className="run-logs">{run.logs.map((message, index) => <p key={`${index}:${message}`}>{message}</p>)}</div>}</div>}
      </section>

      <aside className="right-panel"><div className="inspector-head"><div><span className="inspector-eyebrow">CONFIGURATION</span><h2>{selectedNode?.data.label ?? 'Node inspector'}</h2></div><button className="icon-button subtle" title="Inspector options" onClick={() => setNotice('Node settings are saved with the workflow graph.')}><Settings2 size={15}/></button></div>{selectedNode ? <><div className="inspector-node-type"><span className={`action-icon ${(nodeMeta[selectedNode.data.kind] ?? nodeMeta.log).tint}`}>{(() => { const Icon = (nodeMeta[selectedNode.data.kind] ?? nodeMeta.log).icon; return <Icon size={15}/>; })()}</span><div><strong>{selectedNode.data.kind}</strong><small>Action node · ID {selectedNode.id}</small></div><span className="type-status"><span/> Ready</span></div><div className="inspector-form"><label className="field-label">Node name</label><input className="field-input" value={selectedNode.data.label} onChange={(event) => setNodes((current) => current.map((node) => node.id === selectedNode.id ? { ...node, data: { ...node.data, label: event.target.value } } : node))}/>{Object.entries(selectedNode.data.config ?? {}).map(([key, value]) => <div className="field-group" key={key}><div className="field-label-row"><label className="field-label" htmlFor={`field-${key}`}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}</label><button className="expression-button" title="Insert variable expression" onClick={() => updateConfig(key, '{{variables.startUrl}}')}><Braces size={13}/></button></div>{typeof value === 'boolean' ? <label className="toggle-field"><input type="checkbox" checked={value} onChange={(event) => updateConfig(key, event.target.checked)}/><span>{value ? 'Enabled' : 'Disabled'}</span></label> : <input id={`field-${key}`} className="field-input" value={typeof value === 'string' ? value : JSON.stringify(value)} onChange={(event) => updateConfig(key, event.target.value)} placeholder={`Enter ${key}`}/>}<small className="field-help">{String(value).startsWith('{{') ? 'Dynamic expression' : `Configure ${key} for this action.`}</small></div>)}<div className="inspector-note"><ShieldCheck size={14}/><p>Inputs are validated before execution. Expressions resolve against the workflow variable scope.</p></div></div><div className="inspector-footer"><button className="button-secondary small" onClick={() => { setNodes((current) => current.filter((node) => node.id !== selectedId)); setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(''); setNotice('Node removed'); }}><X size={14}/> Delete node</button><span className="config-live-note">Live edits</span></div></> : <div className="inspector-empty"><Settings2 size={25}/><strong>Select a node to configure</strong><p>Choose any node on the canvas to inspect its settings, inputs and outputs.</p></div>}
        <div className="inspector-lower"><div className="lower-section-title"><span>VARIABLES</span><button onClick={() => setLeftTab('Variables')}>View all <ArrowUpFromLine size={12}/></button></div><div className="mini-variable"><Braces size={14}/><span>startUrl</span><code>string</code></div><div className="mini-variable"><Braces size={14}/><span>pageTitle</span><code>string</code></div><div className="lower-section-title second"><span>QUICK TOOLS</span></div><button className="quick-tool" onClick={() => { setShowJson(!showJson); setMode('Data Processing'); }}><FileJson size={15}/><span>JSON Field Detector</span><ArrowUpFromLine size={13}/></button><button className="quick-tool" onClick={pickElement}><MousePointer2 size={15}/><span>Element recorder</span><span className="coming-tag">Recorder</span></button><button className="quick-tool" disabled title="Image extraction is not implemented yet"><Image size={15}/><span>Image extraction</span><span className="coming-tag">Planned</span></button></div>
        {selectedElement && <div className="selected-element-panel"><div className="lower-section-title"><span>SELECTED ELEMENT</span><button onClick={() => setSelectedElement(null)}><X size={12}/></button></div><div className="element-summary"><code>&lt;{selectedElement.tagName}&gt;</code><span>{selectedElement.text || 'No visible text'}</span></div><label className="field-label">Locator strategy</label><select className="field-input" aria-label="Locator strategy" value={locatorStrategy} onChange={(event) => { setLocatorStrategy(event.target.value); const candidate = selectedElement.selectors.find((item) => item.strategy === event.target.value); if (candidate) setLocatorValue(candidate.value); }}><option value="id">ID</option><option value="css">CSS</option><option value="xpath">XPath</option></select><label className="field-label locator-label">Locator</label><input className="field-input" aria-label="Locator value" value={locatorValue} onChange={(event) => setLocatorValue(event.target.value)}/><div className="locator-actions"><button className="button-secondary small" onClick={testLocator}><Check size={13}/> Test locator</button><button className="button-primary small" onClick={addSelectedElementAction}><Plus size={13}/> Add click node</button></div>{locatorResult && <p className="locator-result">{locatorResult}</p>}<div className="selector-candidates">{selectedElement.selectors.map((item) => <button key={`${item.strategy}:${item.value}`} onClick={() => { setLocatorStrategy(item.strategy); setLocatorValue(item.value); setLocatorResult(`${item.matches} match(es)`); }}><span>{item.strategy.toUpperCase()}</span><code>{item.value}</code><small>{item.matches}×</small></button>)}</div></div>}
      </aside>
    </main>

    <AnimatePresence>{showJson && <motion.div className="modal-backdrop" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="json-modal" initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}><div className="json-modal-head"><div><span className="inspector-eyebrow">DATA PROCESSING</span><h2><FileJson size={19}/> JSON Field Detector</h2><p>Inspect nested JSON, CSV rows or text lines, then export the detected field report.</p></div><button className="icon-button" onClick={() => setShowJson(false)}><X size={17}/></button></div><div className="data-input-tools"><label>Input format <select aria-label="Input format" className="field-input" value={inputFormat} onChange={(event) => setInputFormat(event.target.value as 'json' | 'csv' | 'txt')}><option value="json">JSON</option><option value="csv">CSV</option><option value="txt">TXT</option></select></label><button className="button-secondary small" onClick={loadInputFile}><FolderOpen size={13}/> Load file</button>{inputFilePath && <span className="input-file-name" title={inputFilePath}>{inputFilePath}</span>}</div><textarea aria-label="Data input" value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} spellCheck={false}/><div className="json-modal-actions"><span>{fieldResults.length} fields detected</span><button className="button-secondary" onClick={() => { setJsonInput(''); setFieldResults([]); setInputFilePath(''); }}>Clear</button><label className="output-format">Export as <select aria-label="Output format" className="field-input" value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as 'json' | 'csv' | 'txt')}><option value="json">JSON</option><option value="csv">CSV</option><option value="txt">TXT</option></select></label><button className="button-secondary" disabled={fieldResults.length === 0} onClick={saveFieldResults}><Save size={13}/> Export report</button><button className="button-primary" onClick={inspectJson}><Braces size={14}/> Detect fields</button></div>{fieldResults.length > 0 && <div className="field-results"><div className="field-results-head"><span>FIELD PATH</span><span>TYPE</span><span>PRESENCE</span></div>{fieldResults.map((field) => <div className="field-result" key={field.path}><code>{field.path}</code><span>{field.types.join(' | ')}</span><span>{field.present}/{field.total}</span></div>)}</div>}</motion.section></motion.div>}</AnimatePresence>
    <footer className="statusbar"><div><span className="status-dot"/> FlowForge desktop foundation <span className="status-divider">/</span> {mode}</div><div><span><ShieldCheck size={12}/> Secure context</span><span><GitBranch size={12}/> Graph v1</span><span>UTF-8</span></div></footer>
  </div>;
}

export default App;
