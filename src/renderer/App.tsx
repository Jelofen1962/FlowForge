import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { addEdge, Background, BackgroundVariant, Controls, MiniMap, ReactFlow, MarkerType, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Braces, Bug, Check, ChevronDown, CircleHelp, Clock3, Code2, Command, Eye, FileJson, FolderOpen, GitBranch, Globe2, Home, Image, Layers3, ListTree, Moon, MousePointer2, Play, Plus, Puzzle, Save, Search, Settings2, ShieldCheck, Sparkles, Square, Sun, Workflow as WorkflowIcon, X } from 'lucide-react';
import { detectJsonFields } from '../data/jsonFields';
import { stringifyCsv } from '../data/formats';
import { createDefaultRegistry, executeWorkflow, type RunResult } from '../workflow/engine';
import { validateWorkflow, type Workflow, type WorkflowNode } from '../workflow/schema';
import type { ElementSnapshot, RecordedAction } from '../automation/chromeSession';
import type { RunHistoryEntry } from '../shared/ipc';
import type { BrowserInfo } from '../automation/browsers';

type FlowNodeData = { label: string; kind: string; description: string; config: Record<string, unknown>; status?: string; group?: string };
type FlowNode = Node<FlowNodeData>;
const nodeMeta: Record<string, { label: string; description: string; icon: typeof Globe2; tint: string }> = {
  start: { label: 'Start', description: 'Entry point for this workflow.', icon: Play, tint: 'violet' },
  openUrl: { label: 'Open URL', description: 'Navigate the selected managed browser to a URL.', icon: Globe2, tint: 'blue' },
  click: { label: 'Click element', description: 'Click a matching element in the managed browser.', icon: MousePointer2, tint: 'blue' },
  typeText: { label: 'Type text', description: 'Enter text into a matching input.', icon: Code2, tint: 'blue' },
  selectOption: { label: 'Select option', description: 'Choose an option from a native select element.', icon: ChevronDown, tint: 'blue' },
  waitForElement: { label: 'Wait for element', description: 'Wait until a matching element is present.', icon: Clock3, tint: 'slate' },
  readAttribute: { label: 'Read attribute', description: 'Read visible text or an attribute from an element.', icon: Code2, tint: 'cyan' },
  extractText: { label: 'Extract text', description: 'Read visible text from a matching page element.', icon: Code2, tint: 'cyan' },
  extractLinks: { label: 'Extract links', description: 'Collect links from a page or selected container.', icon: ArrowDownToLine, tint: 'cyan' },
  extractItems: { label: 'Extract repeated items', description: 'Extract structured fields from repeated cards or rows, with bounded pagination.', icon: ListTree, tint: 'cyan' },
  extractImages: { label: 'Extract images', description: 'Collect image URLs, alt text, dimensions, and lazy-loading attributes.', icon: Image, tint: 'cyan' },
  setVariable: { label: 'Set variable', description: 'Assign a value to a workflow variable.', icon: Braces, tint: 'amber' },
  forEach: { label: 'For each item', description: 'Iterate over a bounded collection.', icon: GitBranch, tint: 'orange' },
  if: { label: 'Condition', description: 'Route execution based on a condition.', icon: GitBranch, tint: 'orange' },
  writeFile: { label: 'Save output', description: 'Write data to a selected output file.', icon: Save, tint: 'green' },
  exportCsv: { label: 'Export CSV', description: 'Export an array of row objects to a CSV file.', icon: ArrowDownToLine, tint: 'green' },
  log: { label: 'Log message', description: 'Write a message to the execution console.', icon: Activity, tint: 'slate' },
  subworkflow: { label: 'Run workflow', description: 'Call a reusable workflow from the library.', icon: Puzzle, tint: 'violet' },
};
const initialNodes: FlowNode[] = [
  { id: 'start', type: 'flowNode', position: { x: 110, y: 90 }, data: { label: 'Start', kind: 'start', description: 'Entry point for this workflow.', config: {} } },
  { id: 'open', type: 'flowNode', position: { x: 110, y: 260 }, data: { label: 'Open URL', kind: 'openUrl', description: nodeMeta.openUrl.description, config: { url: 'https://example.com' } } },
  { id: 'extract', type: 'flowNode', position: { x: 110, y: 430 }, data: { label: 'Extract text', kind: 'extractText', description: nodeMeta.extractText.description, config: { selector: 'h1', outputVariable: 'pageTitle' } } },
];
const initialEdges: Edge[] = [
  { id: 'e-start-open', source: 'start', target: 'open', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff' }, style: { stroke: '#8492ff', strokeWidth: 2.2 } },
  { id: 'e-open-extract', source: 'open', target: 'extract', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff' }, style: { stroke: '#8492ff', strokeWidth: 2.2 } },
];
function previewOutput(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 180);
  try { return (JSON.stringify(value) ?? String(value)).slice(0, 180); }
  catch { return String(value).slice(0, 180); }
}

const modes = ['Workflow Builder', 'Web Scraping', 'Task Automation', 'Recorder', 'Data Processing', 'Runs / History'];
const implementedActions = new Set(['start', 'openUrl', 'click', 'typeText', 'selectOption', 'waitForElement', 'readAttribute', 'extractText', 'extractLinks', 'extractItems', 'extractImages', 'setVariable', 'writeFile', 'exportCsv', 'log', 'if', 'forEach', 'subworkflow']);

function FlowNodeCard({ data, selected }: NodeProps<FlowNode>) {
  const meta = nodeMeta[data.kind] ?? nodeMeta.log;
  const Icon = meta.icon;
  return <div className={`flow-node ${selected ? 'selected' : ''} ${data.status ? `run-${data.status}` : ''}`}><Handle type="target" position={Position.Top} />
    <div className={`node-icon ${meta.tint}`}><Icon size={16} /></div>
    <div className="node-copy"><strong>{data.label}</strong><span>{data.description}</span>{data.group && <small className="node-group">{data.group}</small>}</div>
    <span className={`node-state ${data.status ?? ''}`} />
    {data.kind === 'if' ? <><Handle id="true" type="source" position={Position.Bottom} style={{ left: '35%', background: '#43b7c5' }} /><Handle id="false" type="source" position={Position.Bottom} style={{ left: '65%', background: '#e8b45e' }} /></> : data.kind === 'forEach' ? <><Handle id="item" type="source" position={Position.Bottom} style={{ left: '35%', background: '#e8b45e' }} /><Handle id="done" type="source" position={Position.Bottom} style={{ left: '65%', background: '#43b7c5' }} /></> : <Handle type="source" position={Position.Bottom} />}
  </div>;
}
const nodeTypes = { flowNode: FlowNodeCard };

function App() {
  const reducedMotion = useReducedMotion();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedId, setSelectedId] = useState<string>('open');
  const [mode, setMode] = useState(modes[0]);
  const [dark, setDark] = useState(true);
  const [leftTab, setLeftTab] = useState('Actions');
  const [mobilePanel, setMobilePanel] = useState<'actions' | 'inspector' | null>(null);
  const [query, setQuery] = useState('');
  const [run, setRun] = useState<RunResult | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('Ready to build');
  const [workflowName, setWorkflowName] = useState('Product research');
  const [workflowId, setWorkflowId] = useState('workflow-product-research');
  const [variables, setVariables] = useState<Workflow['variables']>([{ name: 'startUrl', type: 'string', value: 'https://example.com', scope: 'workflow' }]);
  const [workflowLibrary, setWorkflowLibrary] = useState<Workflow[]>(() => { try { return JSON.parse(localStorage.getItem('flowforge-workflow-library') ?? '[]') as Workflow[]; } catch { return []; } });
  const [jsonInput, setJsonInput] = useState('[\n  { "id": 1, "url": "https://example.com", "product": { "name": "Sample item", "price": 19.99 } },\n  { "id": 2, "url": "https://example.org", "product": { "name": "Another item", "price": 24.5 } }\n]');
  const [showJson, setShowJson] = useState(false);
  const [jsonProcessing, setJsonProcessing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const [edgeStyle, setEdgeStyle] = useState<'smoothstep' | 'step' | 'straight'>('smoothstep');
  const flowApi = useRef<{ setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void } | null>(null);
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [selectedBrowser, setSelectedBrowser] = useState('chrome');
  const [inputFilePath, setInputFilePath] = useState('');
  const [inputFormat, setInputFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [outputFormat, setOutputFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [browserUrl, setBrowserUrl] = useState('https://example.com');
  const [browserReady, setBrowserReady] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementSnapshot | null>(null);
  const [locatorStrategy, setLocatorStrategy] = useState('css');
  const [locatorValue, setLocatorValue] = useState('');
  const [locatorResult, setLocatorResult] = useState<string>('');
  const [scrapePreview, setScrapePreview] = useState<Record<string, string>[] | null>(null);
  const [scrapePreviewLoading, setScrapePreviewLoading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [fieldResults, setFieldResults] = useState<ReturnType<typeof detectJsonFields>>([]);
  const [undoReady, setUndoReady] = useState(false);
  const [redoReady, setRedoReady] = useState(false);
  const history = useRef<{ nodes: FlowNode[]; edges: Edge[] }[]>([]);
  const future = useRef<{ nodes: FlowNode[]; edges: Edge[] }[]>([]);
  const previous = useRef<{ nodes: FlowNode[]; edges: Edge[] } | null>(null);
  const restoring = useRef(false);
  const clipboard = useRef<{ nodes: FlowNode[]; edges: Edge[] } | null>(null);
  const selectedNode = nodes.find((node) => node.id === selectedId) as FlowNode | undefined;
  const filteredActions = Object.entries(nodeMeta).filter(([, meta]) => meta.label.toLowerCase().includes(query.toLowerCase()));
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge({ ...connection, type: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff', width: 18, height: 18 }, style: { stroke: '#8492ff', strokeWidth: 2.2 } }, eds)), [setEdges, edgeStyle]);
  const workflow = useMemo<Workflow>(() => ({
    schemaVersion: 1, id: workflowId, name: workflowName,
    nodes: nodes.map((node) => ({ id: node.id, type: node.data.kind as WorkflowNode['type'], label: node.data.label, position: node.position, config: node.data.config ?? {}, disabled: false, ...(node.data.group ? { group: node.data.group } : {}) })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}), ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}) })),
    variables,
  }), [nodes, edges, workflowName, workflowId, variables]);
  useEffect(() => {
    if (window.flowforge) void window.flowforge.getRunHistory().then(setRunHistory).catch(() => setRunHistory([]));
  }, []);

  useEffect(() => {
    const snapshot = { nodes, edges };
    if (restoring.current) { restoring.current = false; previous.current = snapshot; return; }
    if (previous.current && (previous.current.nodes !== nodes || previous.current.edges !== edges)) {
      history.current.push(previous.current);
      if (history.current.length > 100) history.current.shift();
      future.current = [];
      setUndoReady(true); setRedoReady(false);
    }
    previous.current = snapshot;
  }, [nodes, edges]);

  const restoreGraph = (snapshot: { nodes: FlowNode[]; edges: Edge[] }) => {
    restoring.current = true;
    setNodes(snapshot.nodes); setEdges(snapshot.edges);
    setUndoReady(history.current.length > 0); setRedoReady(future.current.length > 0);
  };
  const undo = () => {
    const snapshot = history.current.pop();
    if (!snapshot) return;
    future.current.push({ nodes, edges }); restoreGraph(snapshot); setNotice('Undo');
  };
  const redo = () => {
    const snapshot = future.current.pop();
    if (!snapshot) return;
    history.current.push({ nodes, edges }); restoreGraph(snapshot); setNotice('Redo');
  };
  const groupSelected = () => {
    const selected = nodes.filter((node) => node.selected);
    if (selected.length < 2) { setNotice('Select at least two nodes to group (Ctrl/Cmd-click).'); return; }
    const group = window.prompt('Group name', 'Reusable section');
    if (!group?.trim()) return;
    const ids = new Set(selected.map((node) => node.id));
    setNodes((current) => current.map((node) => ids.has(node.id) ? { ...node, data: { ...node.data, group: group.trim() } } : node));
    setNotice(`Grouped ${selected.length} nodes as “${group.trim()}”`);
  };
  const copySelected = () => {
    const selected = nodes.filter((node) => node.selected);
    if (!selected.length) return;
    const ids = new Set(selected.map((node) => node.id));
    clipboard.current = { nodes: selected, edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
    setNotice(`Copied ${selected.length} node(s)`);
  };
  const pasteCopied = () => {
    const copied = clipboard.current;
    if (!copied?.nodes.length) return;
    const ids = new Map(copied.nodes.map((node) => [node.id, `${node.data.kind}-${Math.random().toString(36).slice(2, 8)}`]));
    const pasted = copied.nodes.map((node) => ({ ...node, id: ids.get(node.id)!, selected: true, position: { x: node.position.x + 40, y: node.position.y + 40 }, data: { ...node.data } }));
    const pastedEdges = copied.edges.map((edge) => ({ ...edge, id: `e-${Math.random().toString(36).slice(2, 9)}`, source: ids.get(edge.source)!, target: ids.get(edge.target)! }));
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...pasted]);
    setEdges((current) => [...current, ...pastedEdges]); setSelectedId(pasted[0].id); setNotice(`Pasted ${pasted.length} node(s)`);
  };

  useEffect(() => {
    if (window.flowforge) void window.flowforge.browser.list().then((items) => { setBrowsers(items); if (items.length && !items.some((item) => item.id === selectedBrowser)) setSelectedBrowser(items[0].id); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const typing = event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable);
      if (mod && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowShortcuts((current) => !current); return; }
      if (event.key === 'Escape') { setShowShortcuts(false); setMobilePanel(null); return; }
      if (typing) return;
      if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); void saveWorkflow(); }
      else if (mod && event.key.toLowerCase() === 'o') { event.preventDefault(); void openWorkflow(); }
      else if (mod && event.key === 'Enter') { event.preventDefault(); if (!running) void execute(); }
      else if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (mod && event.key.toLowerCase() === 'c') {
        copySelected();
      } else if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteCopied();
      } else if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault(); copySelected(); pasteCopied();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const ids = new Set(nodes.filter((node) => node.selected || node.id === selectedId).map((node) => node.id));
        if (ids.size) { setNodes((current) => current.filter((node) => !ids.has(node.id))); setEdges((current) => current.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target))); setSelectedId(''); setNotice(`Deleted ${ids.size} node(s)`); }
      } else if (mod && event.key.toLowerCase() === 'g') {
        event.preventDefault(); groupSelected();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const addNode = (kind: string) => {
    const meta = nodeMeta[kind];
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const node: FlowNode = { id, type: 'flowNode', position: { x: 380 + Math.random() * 60, y: 120 + nodes.length * 95 }, data: { label: meta.label, kind, description: meta.description, config: kind === 'openUrl' ? { url: '{{variables.startUrl}}' } : ['extractText', 'click', 'typeText', 'selectOption', 'waitForElement', 'readAttribute'].includes(kind) ? { selector: 'h1', strategy: 'css', ...(kind === 'extractText' ? { outputVariable: 'pageTitle' } : {}), ...(kind === 'typeText' ? { text: '', clear: true } : {}), ...(kind === 'selectOption' ? { value: '' } : {}), ...(kind === 'waitForElement' ? { timeoutMs: 10000 } : {}), ...(kind === 'readAttribute' ? { attribute: 'textContent', outputVariable: 'result' } : {}) } : kind === 'extractLinks' ? { selector: 'a[href]', outputVariable: 'links' } : kind === 'extractImages' ? { selector: 'img', outputVariable: 'images' } : kind === 'extractItems' ? { itemSelector: '.product-card', fields: { title: 'h2', link: 'a[href]' }, nextSelector: '', maxPages: 1, outputVariable: 'items' } : kind === 'setVariable' ? { name: 'result', value: '' } : kind === 'log' ? { message: 'Workflow step completed' } : kind === 'writeFile' ? { filename: 'output.json', content: '{{variables.result}}' } : kind === 'exportCsv' ? { filename: 'output.csv', rows: '{{variables.items}}' } : kind === 'forEach' ? { items: '{{variables.items}}', maxItems: 1000, actions: [{ type: 'log', config: { message: '{{item}}' } }] } : kind === 'if' ? { left: '{{variables.value}}', operator: 'equals', right: '' } : kind === 'subworkflow' ? { workflow: null, inputs: {}, outputs: {}, outputVariable: 'subworkflowResult' } : {} } };
    setNodes((current) => [...current, node]);
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === id })));
    setSelectedId(id);
    setMobilePanel(null);
    requestAnimationFrame(() => flowApi.current?.setCenter(node.position.x + 110, node.position.y + 35, { zoom: 1, duration: 280 }));
    setNotice(`${meta.label} added to canvas`);
  };
  const updateConfig = (key: string, value: unknown) => {
    if (!selectedNode) return;
    if (selectedNode.data.kind === 'extractItems' && ['itemSelector', 'fields', 'nextSelector', 'maxPages'].includes(key)) setScrapePreview(null);
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
      setWorkflowId(input.id); setWorkflowName(input.name); setVariables(input.variables ?? []);
      setNodes(input.nodes.map((node) => ({ id: node.id, type: 'flowNode', position: node.position, data: { label: node.label, kind: node.type, description: nodeMeta[node.type]?.description ?? '', config: node.config, ...(node.group ? { group: node.group } : {}) } })));
      setEdges(input.edges.map((edge) => ({ ...edge, type: edgeStyle, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff' }, style: { stroke: '#8492ff', strokeWidth: 2.2 } })));
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
    if (window.flowforge) void window.flowforge.getRunHistory().then(setRunHistory).catch(() => undefined);
    const statusById = Object.fromEntries(result.steps.map((step) => [step.nodeId, step.status]));
    setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, status: statusById[node.id] ?? (result.status === 'failed' && !statusById[node.id] ? 'skipped' : '') } })));
    if (window.flowforge) { try { setBrowserReady(await window.flowforge.browser.status()); } catch { /* the run result remains authoritative */ } }
    setNotice(result.status === 'succeeded' ? `Run completed · ${result.steps.length} steps` : `${result.status}: ${result.error ?? 'Run stopped'}`);
  };
  const startBrowser = async () => {
    if (!window.flowforge) { setNotice('Managed browser automation requires the Electron desktop app.'); return; }
    setNotice(`Starting ${browsers.find((browser) => browser.id === selectedBrowser)?.label ?? 'browser'}…`);
    const result = await window.flowforge.browser.start(selectedBrowser);
    setBrowserReady(result.ok); setNotice(result.ok ? `${browsers.find((browser) => browser.id === selectedBrowser)?.label ?? 'Browser'} session ready` : result.error ?? 'Could not start browser');
  };
  const stopBrowser = async () => {
    if (!window.flowforge) return;
    const result = await window.flowforge.browser.stop();
    setBrowserReady(false); setSelectedElement(null); setNotice(result.ok ? 'Chrome session stopped' : result.error ?? 'Could not stop Chrome');
  };
  const navigateBrowser = async () => {
    if (!window.flowforge) { setNotice('Managed browser automation requires the Electron desktop app.'); return; }
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
  const recordNextAction = async () => {
    if (!window.flowforge || !browserReady) { setNotice('Launch the managed Chrome session first.'); return; }
    setNotice('Recording next browser action. Interact with the page in Chrome; press Escape to cancel.');
    const result = await window.flowforge.browser.recordNextAction();
    if (!result.ok || !result.action) { setNotice(result.error ?? 'Action recording failed'); return; }
    const action: RecordedAction = result.action;
    const id = `${action.kind}-${Math.random().toString(36).slice(2, 7)}`;
    const node: FlowNode = {
      id, type: 'flowNode',
      position: { x: selectedNode?.position.x ?? 110, y: Math.max(...nodes.map((item) => item.position.y), 0) + 150 },
      data: {
        label: action.kind === 'openUrl' ? 'Open recorded link' : action.kind === 'click' ? `Click ${action.tagName}` : action.kind === 'selectOption' ? `Select ${action.tagName} option` : `Type into ${action.tagName}`,
        kind: action.kind, description: nodeMeta[action.kind].description,
        config: action.kind === 'openUrl' ? { url: action.url } : { selector: action.selector, strategy: action.strategy, ...(action.kind === 'selectOption' ? { value: action.value ?? '' } : action.value !== undefined ? { text: action.value } : {}) },
      },
    };
    setNodes((current) => [...current, node]);
    if (selectedNode) setEdges((current) => {
      const downstream = current.filter((edge) => edge.source === selectedNode.id);
      const remaining = current.filter((edge) => edge.source !== selectedNode.id);
      return [...remaining, { id: `e-${selectedNode.id}-${id}`, source: selectedNode.id, target: id, animated: true, style: { stroke: '#6d82ff', strokeWidth: 1.6 } }, ...downstream.map((edge) => ({ ...edge, source: id, sourceHandle: undefined }))];
    });
    setSelectedId(id);
    setNotice(`Recorded ${action.kind} on <${action.tagName}> and added it to the workflow`);
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
  const previewExtraction = async () => {
    if (!window.flowforge || !browserReady || !selectedNode || selectedNode.data.kind !== 'extractItems') { setNotice('Launch a managed browser and select an extraction node first.'); return; }
    const fields = selectedNode.data.config.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) { setNotice('Configure at least one extraction field.'); return; }
    setScrapePreviewLoading(true);
    try {
      const result = await window.flowforge.browser.previewItems(String(selectedNode.data.config.itemSelector ?? ''), fields as Record<string, string>);
      if (!result.ok || !result.rows) { setScrapePreview(null); setNotice(result.error ?? 'Extraction preview failed'); return; }
      setScrapePreview(result.rows); setNotice(`Previewed ${result.rows.length} row(s) from the current page`);
    } catch (error) {
      setScrapePreview(null); setNotice(`Extraction preview failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setScrapePreviewLoading(false); }
  };
  const testLocator = async () => {
    if (!window.flowforge) { setLocatorResult('Desktop app required'); return; }
    const result = await window.flowforge.browser.testLocator(locatorStrategy, locatorValue);
    setLocatorResult(result.ok ? `${result.matches} match(es)${result.firstText ? ` · “${result.firstText.slice(0, 60)}”` : ''}` : result.error ?? 'Locator test failed');
  };
  const inspectJson = () => {
    setJsonProcessing(true); setNotice('Analyzing data in background…');
    const worker = new Worker(new URL('../data/jsonWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ fields?: ReturnType<typeof detectJsonFields>; error?: string }>) => {
      worker.terminate(); setJsonProcessing(false);
      if (event.data.error) { setFieldResults([]); setNotice(event.data.error); return; }
      const fields = event.data.fields ?? []; setFieldResults(fields); setNotice(`${inputFormat.toUpperCase()} fields detected · ${fields.length} fields`);
    };
    worker.onerror = (event) => { worker.terminate(); setJsonProcessing(false); setFieldResults([]); setNotice(`Data analysis failed: ${event.message}`); };
    worker.postMessage({ input: jsonInput, format: inputFormat });
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
      <div className="brand"><div className="brand-mark"><WorkflowIcon size={19} /></div><span>flowforge</span><span className="brand-beta">STUDIO</span></div>
      <div className="topbar-divider" />
      <button className="icon-button home-button" title="Home dashboard" onClick={() => setShowHome(true)}><Home size={16}/></button>
      <button className="project-switch" disabled title="Multi-project switching is not implemented yet"><Layers3 size={15} /><span>Workspace</span><ChevronDown size={13} /></button>
      <div className="breadcrumb"><span>Workflows</span><span className="crumb-slash">/</span><input className="workflow-name-input" aria-label="Workflow name" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} title="Click to rename workflow" /></div>
      <div className="topbar-spacer" />
      <div className="saved-state"><span className="status-dot" /> Manual save</div>
      <button className="icon-button" title="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
      <button className="icon-button" title="Help" onClick={() => setNotice('FlowForge help: add actions, connect ports, configure nodes, then validate and run.')}><CircleHelp size={16} /></button>
      <button className="button-secondary" onClick={() => { setNodes([{ id: 'start', type: 'flowNode', position: { x: 110, y: 90 }, data: { label: 'Start', kind: 'start', description: nodeMeta.start.description, config: {} } }]); setEdges([]); setSelectedId('start'); setWorkflowId(`workflow-${Date.now()}`); setWorkflowName('Untitled workflow'); setVariables([]); setRun(null); setNotice('New workflow ready'); }}><Plus size={15}/> New</button>
      <button className="button-secondary" onClick={openWorkflow} title="Open workflow (Ctrl+O)"><FolderOpen size={15} /> Open</button>
      <button className="button-primary" onClick={saveWorkflow} title="Save workflow (Ctrl+S)"><Save size={15} /> Save workflow</button>
    </header>

    <div className="modebar"><div className="mode-tabs">{modes.map((item, index) => <button key={item} className={`mode-tab ${mode === item ? 'active' : ''}`} onClick={() => { setMode(item); if (item === 'Data Processing') setShowJson(true); if (item === 'Runs / History') setLeftTab('Runs'); if (item === 'Task Automation') setNotice('Task scheduling is not implemented yet. You can build and run workflows here.'); if (item === 'Web Scraping') setNotice('Use the managed browser controls to navigate and select elements; guided scraping schemas are still in progress.'); }}><span className="mode-glyph">{[<WorkflowIcon size={14}/>, <Globe2 size={14}/>, <Command size={14}/>, <MousePointer2 size={14}/>, <Braces size={14}/>, <Clock3 size={14}/>][index]}</span>{item}</button>)}</div><div className="modebar-right"><span className="local-badge"><ShieldCheck size={13} /> Local workspace</span><button className="kbd-hint" title="Show all keyboard shortcuts (Ctrl+K)" onClick={() => setShowShortcuts(true)}>Ctrl K</button></div></div>

    <main className="workspace">
      <aside className={`left-panel ${mobilePanel === 'actions' ? 'mobile-open' : ''}`} aria-label="Workflow actions and library">
        <div className="panel-tabs">{['Actions', 'Variables', 'Library', 'Runs'].map((tab) => <button key={tab} className={leftTab === tab ? 'selected' : ''} onClick={() => setLeftTab(tab)}>{tab}</button>)}<button className="mobile-drawer-close" type="button" aria-label="Close actions panel" onClick={() => setMobilePanel(null)}><X size={15}/></button></div>
        {leftTab === 'Actions' && <><div className="panel-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an action…" aria-label="Find an action"/><span>/</span></div><div className="action-section-label">BUILDING BLOCKS <span>{filteredActions.length}</span></div><div className="action-list">{filteredActions.map(([kind, meta]) => { const Icon = meta.icon; const unavailable = !implementedActions.has(kind) || kind === 'start'; return <button key={kind} className={`action-row ${unavailable ? 'unavailable' : ''}`} disabled={unavailable} title={kind === 'start' ? 'The workflow already has a start node' : unavailable ? 'This action is not implemented yet' : kind === 'if' ? 'Evaluates a condition and routes to true/false outputs' : meta.description} onClick={() => addNode(kind)}><span className={`action-icon ${meta.tint}`}><Icon size={15}/></span><span className="action-label">{meta.label}<small>{kind === 'start' ? 'Entry point already exists' : unavailable ? 'Not implemented yet' : kind === 'if' ? 'Connect true and false output ports' : meta.description}</small></span>{unavailable ? <span className="coming-tag">Planned</span> : <Plus size={14} className="action-plus"/>}</button>; })}</div><div className="left-panel-bottom"><div className="tip-card"><Sparkles size={15}/><div><strong>Build faster</strong><p>Connect actions to create a reusable automation.</p></div></div><button className="text-link" disabled title="Integration catalog is not implemented yet"><Puzzle size={14}/> Integrations (planned)</button></div></>}
        {leftTab === 'Variables' && <div className="side-content"><div className="section-heading">WORKFLOW VARIABLES <button title="Add variable" onClick={() => { const name = `variable${variables.length + 1}`; setVariables((current) => [...current, { name, type: 'string', value: '', scope: 'workflow' }]); }}><Plus size={14}/></button></div>{variables.map((variable, index) => <div className="variable-card variable-editor" key={`${variable.name}-${index}`}><Braces size={15}/><div><input aria-label="Variable name" value={variable.name} onChange={(event) => setVariables((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))}/><select aria-label="Variable type" value={variable.type} onChange={(event) => setVariables((current) => current.map((item, i) => i === index ? { ...item, type: event.target.value as typeof item.type } : item))}><option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option><option value="object">object</option><option value="array">array</option><option value="secret">secret</option></select><input aria-label={`Value for ${variable.name}`} value={typeof variable.value === 'string' ? variable.value : JSON.stringify(variable.value ?? '')} onChange={(event) => setVariables((current) => current.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} placeholder="Default value"/><button className="expression-button" title="Remove variable" onClick={() => setVariables((current) => current.filter((_, i) => i !== index))}><X size={13}/></button></div></div>)}{variables.length === 0 && <p className="muted-note">No variables yet. Add one to reuse values across workflow nodes.</p>}<p className="muted-note">Expressions use <code>{'{{variables.name}}'}</code> syntax. Secret masking and environment injection are not implemented yet.</p></div>}
        {leftTab === 'Library' && <div className="side-content"><div className="section-heading">REUSABLE WORKFLOWS <button title="Save current workflow to library" onClick={() => { const saved = { ...workflow, updatedAt: new Date().toISOString() }; const next = [...workflowLibrary.filter((item) => item.id !== saved.id), saved]; setWorkflowLibrary(next); localStorage.setItem('flowforge-workflow-library', JSON.stringify(next)); setNotice(`Added ${saved.name} to workflow library`); }}><Plus size={14}/></button></div>{workflowLibrary.length ? workflowLibrary.map((item) => <div className="library-workflow" key={item.id}><button className="library-workflow-open" onClick={() => { const validation = validateWorkflow(item); if (!validation.workflow) { setNotice(validation.errors[0] ?? 'Invalid library workflow'); return; } setWorkflowId(item.id); setWorkflowName(item.name); setVariables(item.variables ?? []); setNodes(item.nodes.map((node) => ({ id: node.id, type: 'flowNode', position: node.position, data: { label: node.label, kind: node.type, description: nodeMeta[node.type]?.description ?? '', config: node.config, ...(node.group ? { group: node.group } : {}) } }))); setEdges(item.edges.map((edge) => ({ ...edge, type: edgeStyle, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff' }, style: { stroke: '#8492ff', strokeWidth: 2.2 } }))); setNotice(`Loaded ${item.name} from library`); }}><Puzzle size={15}/><span><strong>{item.name}</strong><small>{item.nodes.length} nodes · {item.variables.length} variables</small></span></button><button className="expression-button" title="Remove from library" onClick={() => { const next = workflowLibrary.filter((saved) => saved.id !== item.id); setWorkflowLibrary(next); localStorage.setItem('flowforge-workflow-library', JSON.stringify(next)); }}><X size={13}/></button></div>) : <div className="empty-library"><Puzzle size={22}/><strong>Your library starts here</strong><p>Use + to save a copy of the current workflow for reuse.</p></div>}<p className="muted-note">Saved locally in this app. Subworkflow nodes embed a saved workflow snapshot, so existing runs remain portable.</p></div>}
        {leftTab === 'Runs' && <div className="side-content"><div className="section-heading">RECENT RUNS</div>{runHistory.length ? runHistory.map((entry) => <div className="run-history" key={entry.id}><span className={`run-indicator ${entry.status}`}/><div><strong>{entry.workflowName}</strong><small>{entry.status} · {entry.steps} steps · {(entry.durationMs / 1000).toFixed(1)}s</small>{entry.error && <small className="error-text">{entry.error}</small>}<small>{new Date(entry.startedAt).toLocaleString()}</small></div></div>) : run ? <div className="run-history"><span className={`run-indicator ${run.status}`}/><div><strong>{workflowName}</strong><small>{run.status} · {run.steps.length} steps · current session</small></div></div> : <div className="empty-library"><Clock3 size={22}/><strong>No runs yet</strong><p>Execute a workflow to see its results and step history.</p></div>}<p className="muted-note">The latest 50 run summaries are saved locally. Variable values and logs are not stored in run history.</p></div>}
      </aside>
      {mobilePanel && <button className="mobile-drawer-backdrop" type="button" aria-label="Close side panel" onClick={() => setMobilePanel(null)} />}

      <section className="editor-area">
        <div className="editor-toolbar"><div className="editor-title"><button className="mobile-panel-toggle" onClick={() => setMobilePanel(mobilePanel === 'actions' ? null : 'actions')} aria-expanded={mobilePanel === 'actions'} aria-label="Toggle actions panel"><ListTree size={16}/><span>Actions</span></button><span className="canvas-icon"><WorkflowIcon size={16}/></span><div><strong>Workflow canvas</strong><small>{nodes.length} nodes <span>·</span> {edges.length} connections</small></div></div><button className="mobile-panel-toggle inspector-toggle" onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')} aria-expanded={mobilePanel === 'inspector'} aria-label="Toggle node inspector"><Settings2 size={15}/><span>Inspector</span></button><div className="toolbar-actions"><button className="toolbar-button" onClick={undo} disabled={!undoReady} title="Undo (Ctrl/Cmd+Z)">Undo</button><button className="toolbar-button" onClick={redo} disabled={!redoReady} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button><button className="toolbar-button" onClick={groupSelected} title="Select multiple nodes with Ctrl/Cmd-click"><Layers3 size={14}/> Group</button><select className="edge-style-select" aria-label="Connection line style" title="Connection line style" value={edgeStyle} onChange={(event) => setEdgeStyle(event.target.value as typeof edgeStyle)}><option value="smoothstep">Curved</option><option value="step">Right angle</option><option value="straight">Straight</option></select><button className="toolbar-button" onClick={() => { setNodes(initialNodes); setEdges(initialEdges); setNotice('Canvas reset to example workflow'); }}><ArrowDownToLine size={14}/> Reset example</button><span className="toolbar-separator"/><button className="icon-button subtle" title="Minimap is visible in canvas" onClick={() => setNotice('Use the minimap to navigate larger workflows.')}><ListTree size={15}/></button><button className="icon-button subtle" title="Step debugging is not implemented yet" disabled><Bug size={15}/></button><button className="icon-button subtle" title="Additional canvas settings are not implemented yet" disabled><Settings2 size={15}/></button></div></div>
        {(mode === 'Recorder' || mode === 'Web Scraping') && <div className="browser-toolbar"><div className="browser-toolbar-title"><span className={`browser-live-dot ${browserReady ? 'on' : ''}`}/><strong>Browser</strong><small>{browserReady ? 'Session connected' : `${browsers.length} detected`}</small></div><select className="field-input browser-choice" aria-label="Choose browser" value={selectedBrowser} onChange={(event) => setSelectedBrowser(event.target.value)} disabled={browserReady || browsers.length === 0}>{browsers.length ? browsers.map((browser) => <option key={browser.id} value={browser.id}>{browser.label}</option>) : <option value="chrome">No supported browser detected</option>}</select><input aria-label="Browser URL" value={browserUrl} onChange={(event) => setBrowserUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void navigateBrowser(); }} placeholder="https://example.com"/><button className="button-secondary small" onClick={startBrowser} disabled={browserReady || browsers.length === 0} title="Launch selected installed browser"><Play size={13}/> Launch</button><button className="button-secondary small" onClick={navigateBrowser} disabled={!browserReady}><Globe2 size={13}/> Go</button><button className="button-primary small" onClick={pickElement} disabled={!browserReady}><MousePointer2 size={13}/> Alt+click picker</button><button className="button-secondary small" onClick={() => void recordNextAction()} disabled={!browserReady} title="Record the next browser action"><CircleHelp size={13}/> Record next</button><button className="icon-button" title="Stop managed browser" onClick={stopBrowser} disabled={!browserReady}><Square size={13}/></button></div>}
        <div className="canvas-wrap" onMouseDown={(event) => { if (event.button === 1 && event.ctrlKey) { event.preventDefault(); const start = nodes.find((node) => node.data.kind === 'start') ?? nodes[0]; if (start) { setSelectedId(start.id); flowApi.current?.setCenter(start.position.x + 110, start.position.y + 35, { zoom: 1, duration: 350 }); } } }}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={(instance) => { flowApi.current = instance; }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onEdgeClick={(event, edge) => { if (event.altKey) { event.preventDefault(); setEdges((current) => current.map((item) => item.id === edge.id ? { ...item, type: item.type === 'step' ? 'smoothstep' : 'step', markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff' }, style: { stroke: '#8492ff', strokeWidth: 2.2 } } : item)); setNotice('Connection bend style changed'); } }} onNodeContextMenu={(event, node) => { event.preventDefault(); setSelectedId(node.id); setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id || item.selected }))); }} onPaneContextMenu={(event) => { event.preventDefault();  }} multiSelectionKeyCode={['Control', 'Meta']} selectionOnDrag panOnDrag={[2]} onNodeClick={(_event, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId('')} fitView minZoom={0.25} maxZoom={1.5} defaultEdgeOptions={{ type: edgeStyle, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff' }, style: { stroke: '#8492ff', strokeWidth: 2.2 } }} proOptions={{ hideAttribution: true }}><Background color={dark ? '#252b3b' : '#dce1ec'} gap={23} size={1} variant={BackgroundVariant.Dots}/><Controls position="bottom-left" showInteractive={false}/><MiniMap position="bottom-right" nodeColor={(node) => ({ start: '#8b7cff', openUrl: '#6d82ff', extractText: '#43b7c5', extractLinks: '#43b7c5', extractItems: '#43b7c5', extractImages: '#43b7c5', setVariable: '#e8b45e', forEach: '#f08c52', if: '#f08c52', writeFile: '#4bbd8b', log: '#8b97aa', subworkflow: '#8b7cff' }[String((node.data as FlowNodeData).kind)] ?? '#6d82ff')} maskColor={dark ? 'rgba(10,13,20,.65)' : 'rgba(235,239,247,.65)'}/></ReactFlow><button className="canvas-add" onClick={() => addNode('log')}><Plus size={15}/> Add node</button><div className="canvas-hint"><span className="hint-key">Drag</span> to move <span className="hint-dot"/> <span className="hint-key">Connect</span> node ports</div></div>
        <div className="runbar"><div className="runbar-left"><span className={`run-light ${running ? 'active' : ''}`}/><span>{notice}</span></div><div className="runbar-right"><button className="button-secondary small" onClick={() => { const validation = validateWorkflow(workflow); setNotice(validation.errors.length ? validation.errors[0] : 'Graph validation passed'); }}><ShieldCheck size={14}/> Validate</button><button className="button-primary run-button" disabled={running} onClick={execute} title="Run workflow (Ctrl+Enter)">{running ? <Activity size={14} className="spin"/> : <Play size={14} fill="currentColor"/>}{running ? 'Running…' : 'Run workflow'}</button><button className="icon-button" title="Stop run" disabled={!running} onClick={async () => { if (activeRunId && window.flowforge) { const cancelled = await window.flowforge.cancelWorkflow(activeRunId); setNotice(cancelled ? 'Cancellation requested' : 'Run is already finishing'); } }}><Square size={14}/></button></div></div>
        {run && <div className="execution-panel"><div className="execution-head"><div><Activity size={15}/><strong>Latest execution</strong><span className={`run-tag ${run.status}`}>{run.status}</span></div><button className="icon-button subtle" onClick={() => setRun(null)}><X size={14}/></button></div><div className="execution-steps">{run.steps.map((step) => <div className="execution-step" key={step.nodeId}><span className={`step-check ${step.status}`}>{step.status === 'succeeded' ? <Check size={12}/> : <X size={12}/>}</span><strong>{nodes.find((node) => node.id === step.nodeId)?.data.label ?? step.nodeId}</strong><span>{step.durationMs} ms</span>{step.error && <code className="step-error">{step.error}</code>}{step.output !== undefined && <code className="step-output">{previewOutput(step.output)}</code>}</div>)}</div>{run.error && <p className="error-text">{run.error}</p>}{run.logs.length > 0 && <div className="run-logs">{run.logs.map((message, index) => <p key={`${index}:${message}`}>{message}</p>)}</div>}</div>}
      </section>

      <aside className={`right-panel ${mobilePanel === 'inspector' ? 'mobile-open' : ''}`} aria-label="Node configuration"><div className="inspector-head"><div><span className="inspector-eyebrow">CONFIGURATION</span><h2>{selectedNode?.data.label ?? 'Node inspector'}</h2></div><div className="inspector-head-actions"><button className="icon-button subtle" title="Inspector options" onClick={() => setNotice('Node settings are saved with the workflow graph.')}><Settings2 size={15}/></button><button className="mobile-drawer-close" type="button" aria-label="Close node inspector" onClick={() => setMobilePanel(null)}><X size={15}/></button></div></div>{selectedNode ? <><div className="inspector-node-type"><span className={`action-icon ${(nodeMeta[selectedNode.data.kind] ?? nodeMeta.log).tint}`}>{(() => { const Icon = (nodeMeta[selectedNode.data.kind] ?? nodeMeta.log).icon; return <Icon size={15}/>; })()}</span><div><strong>{selectedNode.data.kind}</strong><small>Action node · ID {selectedNode.id}{selectedNode.data.group ? ` · ${selectedNode.data.group}` : ''}</small></div><span className="type-status"><span/> Ready</span></div><div className="inspector-form"><label className="field-label" htmlFor="inspector-node-name">Node name</label><input id="inspector-node-name" className="field-input" value={selectedNode.data.label} onChange={(event) => setNodes((current) => current.map((node) => node.id === selectedNode.id ? { ...node, data: { ...node.data, label: event.target.value } } : node))}/>{selectedNode.data.kind === 'subworkflow' && <div className="field-group extraction-schema"><label className="field-label">Reusable workflow</label><select className="field-input" aria-label="Reusable workflow" value={String((selectedNode.data.config.workflow as Workflow | null)?.id ?? '')} onChange={(event) => { const chosen = workflowLibrary.find((item) => item.id === event.target.value); updateConfig('workflow', chosen ?? null); if (chosen) setNotice(`Selected reusable workflow: ${chosen.name}`); }}><option value="">Choose saved workflow…</option>{workflowLibrary.filter((item) => item.id !== workflowId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small className="field-help">Save a workflow to the library first. The selected workflow definition is embedded in this node.</small></div>}
{selectedNode.data.kind === 'extractItems' && <div className="field-group extraction-schema"><div className="field-label-row"><label className="field-label">Extraction fields</label><button className="expression-button" title="Add field" onClick={() => updateConfig('fields', { ...(typeof selectedNode.data.config.fields === 'object' && selectedNode.data.config.fields !== null ? selectedNode.data.config.fields as Record<string, string> : {}), [`field${Object.keys((selectedNode.data.config.fields ?? {}) as object).length + 1}`]: 'h2' })}><Plus size={13}/></button></div>{Object.entries((typeof selectedNode.data.config.fields === 'object' && selectedNode.data.config.fields !== null ? selectedNode.data.config.fields : {}) as Record<string, string>).map(([fieldName, selector]) => <div className="field-label-row" key={fieldName}><input className="field-input" aria-label="Output field name" value={fieldName} onChange={(event) => { const fields = { ...((selectedNode.data.config.fields ?? {}) as Record<string, string>) }; const next = event.target.value; delete fields[fieldName]; if (next.trim()) fields[next] = selector; updateConfig('fields', fields); }}/><input className="field-input" aria-label={`Selector for ${fieldName}`} value={selector} onChange={(event) => updateConfig('fields', { ...((selectedNode.data.config.fields ?? {}) as Record<string, string>), [fieldName]: event.target.value })} placeholder="CSS selector"/><button className="expression-button" title={`Remove ${fieldName}`} onClick={() => { const fields = { ...((selectedNode.data.config.fields ?? {}) as Record<string, string>) }; delete fields[fieldName]; updateConfig('fields', fields); }}><X size={13}/></button></div>)}<small className="field-help">Each field maps an output name to a CSS selector inside every matched item.</small><button className="button-secondary small" onClick={() => void previewExtraction()} disabled={!browserReady || scrapePreviewLoading} aria-busy={scrapePreviewLoading}><Eye size={13}/> {scrapePreviewLoading ? 'Previewing…' : 'Preview current page'}</button>{scrapePreview && <div className="scrape-preview" aria-live="polite"><strong>Current page preview · {scrapePreview.length} rows · first 5 shown</strong>{scrapePreview.length ? scrapePreview.slice(0, 5).map((row, index) => <pre key={index}>{JSON.stringify(row, null, 2)}</pre>) : <p>No matching items found. Check the repeated-item selector and field selectors.</p>}</div>}</div>}{Object.entries(selectedNode.data.config ?? {}).filter(([key]) => !(selectedNode.data.kind === 'extractItems' && key === 'fields') && !(selectedNode.data.kind === 'subworkflow' && key === 'workflow')).map(([key, value]) => <div className="field-group" key={key}><div className="field-label-row"><label className="field-label" htmlFor={`field-${key}`}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}</label><select className="variable-insert" aria-label={`Insert variable into ${key}`} title="Insert a workflow variable" value="" onChange={(event) => { if (event.target.value) updateConfig(key, `{{variables.${event.target.value}}}`); }}><option value="">Variable…</option>{variables.map((variable) => <option key={variable.name} value={variable.name}>{variable.name}</option>)}</select></div>{selectedNode.data.kind === 'if' && key === 'operator' ? <select id={`field-${key}`} className="field-input" value={String(value)} onChange={(event) => updateConfig(key, event.target.value)}><option value="equals">Equals</option><option value="notEquals">Does not equal</option><option value="contains">Contains</option><option value="greaterThan">Greater than</option><option value="lessThan">Less than</option><option value="isTruthy">Is truthy</option></select> : typeof value === 'boolean' ? <label className="toggle-field"><input type="checkbox" checked={value} onChange={(event) => updateConfig(key, event.target.checked)}/><span>{value ? 'Enabled' : 'Disabled'}</span></label> : <input id={`field-${key}`} className="field-input" value={typeof value === 'string' ? value : JSON.stringify(value)} onChange={(event) => { const next = event.target.value; updateConfig(key, (key === 'actions' || (selectedNode.data.kind === 'subworkflow' && ['inputs', 'outputs'].includes(key))) ? (() => { try { return JSON.parse(next); } catch { return next; } })() : ['maxPages', 'maxItems', 'timeoutMs'].includes(key) && next.trim() !== '' ? Number(next) : next); }} placeholder={`Enter ${key}`}/>}<small className="field-help">{String(value).startsWith('{{') ? 'Dynamic expression' : `Configure ${key} for this action.`}</small></div>)}{['click', 'typeText', 'selectOption', 'waitForElement', 'readAttribute'].includes(selectedNode.data.kind) && <div className="field-group"><label className="field-label" htmlFor="field-frameSelector">Frame selector (optional)</label><input id="field-frameSelector" className="field-input" value={String(selectedNode.data.config.frameSelector ?? '')} onChange={(event) => updateConfig('frameSelector', event.target.value)} placeholder="iframe#checkout"/><small className="field-help">CSS selector for a frame in the top-level page. Leave blank for the main document.</small></div>}<div className="inspector-note"><ShieldCheck size={14}/><p>Inputs are validated before execution. Expressions resolve against the workflow variable scope.</p></div></div><div className="inspector-footer"><button className="button-secondary small" onClick={() => { setNodes((current) => current.filter((node) => node.id !== selectedId)); setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(''); setNotice('Node removed'); }}><X size={14}/> Delete node</button><span className="config-live-note">Live edits</span></div></> : <div className="inspector-empty"><Settings2 size={25}/><strong>Select a node to configure</strong><p>Choose any node on the canvas to inspect its settings, inputs and outputs.</p></div>}
        <div className="inspector-lower"><div className="lower-section-title"><span>VARIABLES</span><button onClick={() => setLeftTab('Variables')}>View all <ArrowUpFromLine size={12}/></button></div>{variables.slice(0, 3).map((variable) => <div className="mini-variable" key={variable.name}><Braces size={14}/><span>{variable.name}</span><code>{variable.type}</code></div>)}<div className="lower-section-title second"><span>QUICK TOOLS</span></div><button className="quick-tool" onClick={() => { setShowJson(!showJson); setMode('Data Processing'); }}><FileJson size={15}/><span>JSON Field Detector</span><ArrowUpFromLine size={13}/></button><button className="quick-tool" onClick={pickElement}><MousePointer2 size={15}/><span>Element recorder</span><span className="coming-tag">Recorder</span></button><button className="quick-tool" onClick={() => { addNode("extractImages"); setMode("Web Scraping"); }}><Image size={15}/><span>Image extraction</span><span className="coming-tag">Add node</span></button></div>
        {selectedElement && <div className="selected-element-panel"><div className="lower-section-title"><span>SELECTED ELEMENT</span><button onClick={() => setSelectedElement(null)}><X size={12}/></button></div><div className="element-summary"><code>&lt;{selectedElement.tagName}&gt;</code><span>{selectedElement.text || 'No visible text'}</span></div><label className="field-label">Locator strategy</label><select className="field-input" aria-label="Locator strategy" value={locatorStrategy} onChange={(event) => { setLocatorStrategy(event.target.value); const candidate = selectedElement.selectors.find((item) => item.strategy === event.target.value); if (candidate) setLocatorValue(candidate.value); }}><option value="id">ID</option><option value="css">CSS</option><option value="xpath">XPath</option></select><label className="field-label locator-label">Locator</label><input className="field-input" aria-label="Locator value" value={locatorValue} onChange={(event) => setLocatorValue(event.target.value)}/><div className="locator-actions"><button className="button-secondary small" onClick={testLocator}><Check size={13}/> Test locator</button><button className="button-primary small" onClick={addSelectedElementAction}><Plus size={13}/> Add click node</button></div>{locatorResult && <p className="locator-result">{locatorResult}</p>}<div className="selector-candidates">{selectedElement.selectors.map((item) => <button key={`${item.strategy}:${item.value}`} onClick={() => { setLocatorStrategy(item.strategy); setLocatorValue(item.value); setLocatorResult(`${item.matches} match(es)`); }}><span>{item.strategy.toUpperCase()}</span><code>{item.value}</code><small>{item.matches}×</small></button>)}</div></div>}
      </aside>
    </main>

    <AnimatePresence>{showJson && <motion.div className="modal-backdrop" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="json-modal" initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}><div className="json-modal-head"><div><span className="inspector-eyebrow">DATA PROCESSING</span><h2><FileJson size={19}/> JSON Field Detector</h2><p>Inspect nested JSON, CSV rows or text lines, then export the detected field report.</p></div><button className="icon-button" onClick={() => setShowJson(false)}><X size={17}/></button></div><div className="data-input-tools"><label>Input format <select aria-label="Input format" className="field-input" value={inputFormat} onChange={(event) => setInputFormat(event.target.value as 'json' | 'csv' | 'txt')}><option value="json">JSON</option><option value="csv">CSV</option><option value="txt">TXT</option></select></label><button className="button-secondary small" onClick={loadInputFile}><FolderOpen size={13}/> Load file</button>{inputFilePath && <span className="input-file-name" title={inputFilePath}>{inputFilePath}</span>}</div><textarea aria-label="Data input" value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} spellCheck={false}/><div className="json-modal-actions"><span>{fieldResults.length} fields detected</span><button className="button-secondary" onClick={() => { setJsonInput(''); setFieldResults([]); setInputFilePath(''); }}>Clear</button><label className="output-format">Export as <select aria-label="Output format" className="field-input" value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as 'json' | 'csv' | 'txt')}><option value="json">JSON</option><option value="csv">CSV</option><option value="txt">TXT</option></select></label><button className="button-secondary" disabled={fieldResults.length === 0} onClick={saveFieldResults}><Save size={13}/> Export report</button><button className="button-primary" onClick={inspectJson} disabled={jsonProcessing}>{jsonProcessing ? <Activity size={14} className="spin"/> : <Braces size={14}/>} {jsonProcessing ? 'Analyzing…' : 'Detect fields'}</button></div>{fieldResults.length > 0 && <div className="field-results"><div className="field-results-head"><span>FIELD PATH</span><span>TYPE</span><span>PRESENCE</span></div>{fieldResults.map((field) => <div className="field-result" key={field.path}><code>{field.path}</code><span>{field.types.join(' | ')}</span><span>{field.present}/{field.total}</span></div>)}</div>}</motion.section></motion.div>}</AnimatePresence>
    <AnimatePresence>{showHome && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHome(false); }}><motion.section className="home-dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><div className="home-dashboard-head"><div><span className="inspector-eyebrow">FLOWFORGE STUDIO</span><h2><Home size={20}/> Workspace home</h2><p>Pick up a workflow or start a fresh automation.</p></div><button className="icon-button" onClick={() => setShowHome(false)}><X size={16}/></button></div><div className="home-card-grid"><button className="home-card home-new" onClick={() => { setNodes([{ id: 'start', type: 'flowNode', position: { x: 110, y: 90 }, data: { label: 'Start', kind: 'start', description: nodeMeta.start.description, config: {} } }]); setEdges([]); setSelectedId('start'); setWorkflowId(`workflow-${Date.now()}`); setWorkflowName('Untitled workflow'); setVariables([]); setShowHome(false); setNotice('New workflow ready'); }}><Plus size={24}/><strong>New workflow</strong><span>Start with an empty canvas</span></button><div className="home-card"><WorkflowIcon size={22}/><strong>{workflowName}</strong><span>Current workflow · {nodes.length} nodes · {edges.length} connections</span><button className="button-secondary small" onClick={() => setShowHome(false)}>Continue editing</button></div>{workflowLibrary.slice(0, 6).map((item) => <button className="home-card" key={item.id} onClick={() => { const validation = validateWorkflow(item); if (!validation.workflow) { setNotice(validation.errors[0] ?? 'Invalid library workflow'); setShowHome(false); return; } setWorkflowId(item.id); setWorkflowName(item.name); setVariables(item.variables ?? []); setNodes(item.nodes.map((node) => ({ id: node.id, type: 'flowNode', position: node.position, data: { label: node.label, kind: node.type, description: nodeMeta[node.type]?.description ?? '', config: node.config, ...(node.group ? { group: node.group } : {}) } }))); setEdges(item.edges.map((edge) => ({ ...edge, type: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed, color: '#8492ff' }, style: { stroke: '#8492ff', strokeWidth: 2.2 } }))); setShowHome(false); setNotice(`Loaded ${item.name}`); }}><Puzzle size={22}/><strong>{item.name}</strong><span>{item.nodes.length} nodes · {item.variables.length} variables</span></button>)}</div></motion.section></motion.div>}</AnimatePresence>
    <AnimatePresence>{showShortcuts && <motion.div className="modal-backdrop shortcuts-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowShortcuts(false); }}><motion.section className="shortcuts-modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><div className="json-modal-head"><div><span className="inspector-eyebrow">QUICK REFERENCE</span><h2><Command size={19}/> Keyboard shortcuts</h2><p>Press Escape to close. Hover over controls for extra hints.</p></div><button className="icon-button" title="Close shortcuts (Esc)" onClick={() => setShowShortcuts(false)}><X size={17}/></button></div><div className="shortcut-list">{[['Ctrl / ⌘ + K','Show or hide this shortcut guide'],['Ctrl / ⌘ + S','Save workflow'],['Ctrl / ⌘ + O','Open workflow'],['Ctrl / ⌘ + Enter','Run workflow'],['Ctrl / ⌘ + Z','Undo canvas changes'],['Ctrl / ⌘ + Shift + Z','Redo canvas changes'],['Ctrl / ⌘ + Y','Redo canvas changes'],['Ctrl / ⌘ + C','Copy selected nodes'],['Ctrl / ⌘ + V','Paste copied nodes'],['Ctrl / ⌘ + D','Duplicate selection'],['Ctrl / ⌘ + G','Group selection'],['Delete / Backspace','Delete selected nodes'],['Alt + click connection','Toggle right-angle / curved bend'],['Ctrl + middle-click','Focus the Start node'],['Right-click','Open node or canvas menu'],['Left-drag on empty canvas','Box-select nodes'],['Right-drag','Pan canvas'],['Escape','Close dialogs'],['Alt + click','Select a webpage element in recorder mode'],['Enter','Navigate to the URL in browser toolbar']].map(([keys, description]) => <div className="shortcut-row" key={keys}><span>{description}</span><kbd>{keys}</kbd></div>)}</div></motion.section></motion.div>}</AnimatePresence>
    <footer className="statusbar"><div><span className="status-dot"/> FlowForge desktop foundation <span className="status-divider">/</span> {mode}</div><div><span><ShieldCheck size={12}/> Secure context</span><span><GitBranch size={12}/> Graph v1</span><span>UTF-8</span></div></footer>
  </div>;
}

export default App;
