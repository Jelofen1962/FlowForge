import { useEffect, useMemo, useRef, useState } from "react";
import { createId, normalizeWorkflow, validateWorkflow, type WorkflowGroup, type WorkflowVariable } from "../core/workflow";
import { parseRecorderMessage, selectionToLocator, type RecorderSelection } from "../core/recorder";
import { validateSessionSnapshot } from "../core/session";
import {
  Activity, AppWindow, ArrowDown, ArrowUp, Braces, Check, ChevronDown, CircleHelp, Clock3,
  Code2, Cookie, Copy, FilePlus2, FolderOpen, Globe2, GripVertical, Layers3, MousePointer2,
  Play, Plus, Save, Settings2, ShieldCheck, Square, Terminal, Trash2, Zap
} from "lucide-react";

type Target = { strategy: string; value: string };
type Step = { id:string; name:string; type:string; target:Target; url?:string; text?:string; key?:string; ms?:number; timeout?:number; expected?:string; disabled?:boolean; onError?:string; clearFirst?:boolean; groupId?:string; retry?:{attempts:number;delayMs:number} };
type RunRecord = { id:string; workflow:string; startedAt:string; endedAt?:string; status:"running"|"success"|"failed"|"stopped"|"interrupted"; totalSteps:number; successfulSteps:number; failedSteps:number; skippedSteps:number; error?:string; durationMs?:number };
const makeStep = (type="click"):Step => ({ id:crypto.randomUUID(), name: ({click:"Click element",type:"Type text",waitVisible:"Wait until visible",waitClickable:"Wait until clickable",navigate:"Navigate to URL",key:"Keyboard shortcut",wait:"Pause"} as Record<string,string>)[type] || "New step", type, target:{strategy:"xpath",value:""}, url:"https://example.com", text:"", key:"ENTER", ms:1000, timeout:10000, onError:"stop", clearFirst:true });
const starter:Step[] = [
  {...makeStep("navigate"), name:"Open website", url:"https://example.com"},
  {...makeStep("waitVisible"), name:"Wait for heading", target:{strategy:"css",value:"h1"}, timeout:10000},
  {...makeStep("click"), name:"Click target", target:{strategy:"xpath",value:"//button[normalize-space()='Continue']"}},
  {...makeStep("type"), name:"Enter text", target:{strategy:"css",value:"input[name='email']"}, text:"hello@example.com"}
];
const stepTypes = [
  ["click","Click element"],["type","Type text"],["key","Keyboard shortcut"],["navigate","Navigate to URL"],
  ["waitVisible","Wait until visible"],["waitClickable","Wait until clickable"],["wait","Wait / pause"],
  ["assertText","Assert text"],["select","Select option"],["screenshot","Take screenshot"],["back","Go back"],["forward","Go forward"],["refresh","Refresh page"]
];
export default function App(){
  const [steps,setSteps]=useState<Step[]>(starter);
  const [workflowName,setWorkflowName]=useState("Untitled workflow");
  const [groups,setGroups]=useState<WorkflowGroup[]>([]);
  const [variables,setVariables]=useState<WorkflowVariable[]>([]);
  const [saveState,setSaveState]=useState("Saved locally");
  const [selected,setSelected]=useState(starter[0].id);
  const [tab,setTab]=useState("workflow");
  const [browser,setBrowser]=useState("chrome");
  const [startUrl,setStartUrl]=useState("https://example.com");
  const [disableImages,setDisableImages]=useState(false);
  const [disableCss,setDisableCss]=useState(false);
  const [closeBrowser,setCloseBrowser]=useState(false);
  const [profileName,setProfileName]=useState("Default profile");
  const [userDataDir,setUserDataDir]=useState("");
  const [running,setRunning]=useState(false);
  const [recording,setRecording]=useState(false);
  const [recordUrl,setRecordUrl]=useState("https://example.com");
  const [logs,setLogs]=useState<string[]>(["FlowForge engine ready.", "Create a workflow or run the sample steps."]);
  const [runState,setRunState]=useState<Record<string,string>>({});
  const [runHistory,setRunHistory]=useState<RunRecord[]>(()=>{try{return JSON.parse(localStorage.getItem("flowforge.runHistory.v1")||"[]").slice(0,50)}catch{return []}});
  const activeRunId=useRef<string|null>(null);
  const current=steps.find(s=>s.id===selected) || steps[0];
  const workflowDocument = useMemo(() => ({version:1 as const,name:workflowName,startUrl,browser:browser as "chrome"|"edge",steps,groups,variables}), [workflowName,startUrl,browser,steps,groups,variables]);
  const validation = useMemo(() => validateWorkflow(workflowDocument), [workflowDocument]);
  useEffect(()=>{
    try { const raw=localStorage.getItem("flowforge.workflow.v1"); if(raw){ const doc=normalizeWorkflow(JSON.parse(raw)); setWorkflowName(doc.name); setStartUrl(doc.startUrl); setBrowser(doc.browser); setSteps((doc.steps.length?doc.steps:[]) as unknown as Step[]); setGroups(doc.groups); setVariables(doc.variables); if(doc.steps[0])setSelected(doc.steps[0].id); } }
    catch { setLogs(old=>[...old,"Saved draft could not be loaded; the sample workflow remains available."]); }
    // Load the local draft only once on application start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    setSaveState("Saving…");
    const handle=window.setTimeout(()=>{try{localStorage.setItem("flowforge.workflow.v1",JSON.stringify(workflowDocument));setSaveState("Saved locally");}catch{setSaveState("Local save failed");}},350);
    return ()=>window.clearTimeout(handle);
  },[workflowDocument]);
  useEffect(()=>{
    const off=window.flowforge.onLog(line=>{ try{
      const p=JSON.parse(line);
      const safeLine = p.type === "session-export" ? JSON.stringify({type:p.type,data:{origin:p.data?.origin,cookies:p.data?.cookies?.length||0,localStorage:p.data?.localStorage?.length||0,sessionStorage:p.data?.sessionStorage?.length||0}}) : line.trim();
      setLogs(old=>[...old, safeLine].slice(-300));
      if(p.type === "session-export" && p.data) {
        const json=JSON.stringify(p.data,null,2); const blob=new Blob([json],{type:"application/json"}); const a=document.createElement("a"); const url=URL.createObjectURL(blob); a.href=url; a.download=`flowforge-session-${new Date().toISOString().replace(/[:.]/g,"-")}.json`; a.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
        setLogs(old=>[...old,`Session snapshot exported for ${p.data.origin}. Treat the file as a password-equivalent secret.`].slice(-300));
      }
      if(p.type === "session-import") setLogs(old=>[...old,`Session import finished: ${p.data.cookies} cookies added, ${p.data.expired} expired skipped, ${p.data.rejected} rejected, ${p.data.storageEntries} storage entries restored.`].slice(-300));
      if(p.type==="step") {
        setRunState(s=>({...s,[steps[p.data.index]?.id]:p.data.status}));
        const runId=activeRunId.current;
        if(runId) setRunHistory(items=>items.map(item=>item.id!==runId?item:{...item,successfulSteps:item.successfulSteps+(p.data.status==="success"?1:0),failedSteps:item.failedSteps+(p.data.status==="error"?1:0),skippedSteps:item.skippedSteps+(p.data.status==="skipped"?1:0),error:p.data.status==="error"?String(p.data.error||"Step failed"):item.error}));
      }
      if(p.type==="step-retry") setLogs(old=>[...old,`Retrying step ${p.data.index+1} (${p.data.nextAttempt}/${p.data.maxAttempts}): ${p.data.error}`].slice(-300));
      if(p.type==="done" && activeRunId.current) {
        const id=activeRunId.current; const endedAt=new Date().toISOString();
        setRunHistory(items=>items.map(item=>item.id!==id?item:{...item,endedAt,status:(p.data.stopped?"stopped":p.data.success&&item.failedSteps===0?"success":"failed") as RunRecord["status"],durationMs:Math.max(0,Date.parse(endedAt)-Date.parse(item.startedAt))}));
        activeRunId.current=null;
      }
      if(p.type==="error" && activeRunId.current) {
        const id=activeRunId.current; const endedAt=new Date().toISOString();
        setRunHistory(items=>items.map(item=>item.id!==id?item:{...item,endedAt,status:"failed" as RunRecord["status"],error:String(p.data?.message||"Engine error"),durationMs:Math.max(0,Date.parse(endedAt)-Date.parse(item.startedAt))}));
        activeRunId.current=null;
      }
      if(p.type==="recorder" && p.data?.status==="selected" && p.data.selection) {
        const message=parseRecorderMessage({channel:"FLOWFORGE_RECORDER_V1",type:"selected",data:p.data.selection});
        if(message?.type==="selected") {
          const selectedElement=message.data as RecorderSelection;
          const step:Step={id:createId(),name:`Click ${selectedElement.tagName}${selectedElement.text?`: ${selectedElement.text.slice(0,48)}`:""}`,type:"click",target:selectionToLocator(selectedElement,"xpath"),timeout:10000,onError:"stop",clearFirst:true};
          setSteps(all=>[...all,step]);setSelected(step.id);
          setLogs(old=>[...old,`Recorded ${selectedElement.tagName}: XPath locator added.`].slice(-300));
        }
      }
      if(p.type==="recorder" && p.data?.status==="stopped")setRecording(false);
    }catch{}});
    const done=window.flowforge.onFinished(r=>{setRunning(false);setLogs(old=>[...old,`Engine exited (${r.code}).`]);if(activeRunId.current){const id=activeRunId.current;const endedAt=new Date().toISOString();setRunHistory(items=>items.map(item=>item.id!==id?item:{...item,endedAt,status:(r.stopped?"stopped":r.code===0?"success":"interrupted") as RunRecord["status"],error:r.code===0?item.error:`Runner exited with code ${r.code}`,durationMs:Math.max(0,Date.parse(endedAt)-Date.parse(item.startedAt))}));activeRunId.current=null;}});
    return ()=>{off();done()};
  },[steps]);
  useEffect(()=>{try{localStorage.setItem("flowforge.runHistory.v1",JSON.stringify(runHistory.slice(0,50)))}catch{}},[runHistory]);
  const update=(patch:Partial<Step>)=>setSteps(all=>all.map(s=>s.id===selected?{...s,...patch}:s));
  const addStep=(type="click")=>{const s=makeStep(type);setSteps(all=>[...all,s]);setSelected(s.id);setTab("workflow")};
  const duplicateStep=()=>{if(!current)return;const clone={...current,id:createId(),name:`${current.name} copy`,target:{...current.target}};const i=steps.findIndex(s=>s.id===current.id);const next=[...steps];next.splice(i+1,0,clone);setSteps(next);setSelected(clone.id)};
  const addGroup=()=>{const group={id:createId(),name:`Group ${groups.length+1}`,collapsed:false};setGroups(all=>[...all,group]);setLogs(old=>[...old,`Created ${group.name}.`])};
  const addVariable=()=>setVariables(all=>[...all,{id:createId(),name:`variable${all.length+1}`,value:"",secret:false}]);
  const deleteStep=(id:string)=>{const next=steps.filter(x=>x.id!==id);setSteps(next);if(selected===id)setSelected(next[0]?.id||"")};
  const move=(direction:number)=>{const i=steps.findIndex(s=>s.id===selected),j=i+direction;if(j<0||j>=steps.length)return;const copy=[...steps];[copy[i],copy[j]]=[copy[j],copy[i]];setSteps(copy)};
  const run=async()=>{if(steps.length===0){setLogs(["Add at least one step before running the workflow."]);return}if(!validation.valid){setLogs(["Workflow validation failed:",...validation.errors]);return}setLogs([]);setRunState({});setRunning(true);const startedAt=new Date().toISOString();const record:RunRecord={id:createId(),workflow:workflowName,startedAt,status:"running",totalSteps:steps.length,successfulSteps:0,failedSteps:0,skippedSteps:0};activeRunId.current=record.id;setRunHistory(items=>[record,...items].slice(0,50));const result=await window.flowforge.start({steps,startUrl,browser,variables,profile:{name:profileName,browser,userDataDir:userDataDir||undefined},optimizations:{disableImages,disableCss},closeBrowserWhenDone:closeBrowser});if(!result.ok){setRunning(false);activeRunId.current=null;const endedAt=new Date().toISOString();setRunHistory(items=>items.map(item=>item.id!==record.id?item:{...item,endedAt,status:"failed" as RunRecord["status"],error:result.error||"Could not start engine.",durationMs:Date.parse(endedAt)-Date.parse(startedAt)}));setLogs([result.error||"Could not start engine."]) }};
  const startRecorder=async()=>{const result=await window.flowforge.recorderStart({startUrl:recordUrl,browser,profile:{name:profileName,browser,userDataDir:userDataDir||undefined}});if(result.ok){setRecording(true);setRunning(true);setLogs(old=>[...old,"Recorder browser started. Hover over a page element and click to capture its locator."])}else setLogs(old=>[...old,result.error||"Could not start recorder."])};
  const stopRecorder=async()=>{const result=await window.flowforge.recorderStop();if(!result.ok)setLogs(old=>[...old,result.error||"Could not stop recorder."]);};
  const saveProfile=async()=>{const r=await window.flowforge.saveProfile({name:profileName,browser,userDataDir,optimizations:{disableImages,disableCss}});setLogs(old=>[...old,`Profile saved: ${r.path||profileName}`])};
  const exportSession=async()=>{const r=await window.flowforge.sessionExport();if(!r.ok)setLogs(old=>[...old,r.error||"Could not export session."]);else setLogs(old=>[...old,"Session export requested. The browser must be running on the origin you want to capture."])};
  const importSession=()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw new Error("Session file exceeds the 2 MB limit.");const snapshot=validateSessionSnapshot(JSON.parse(await f.text()));const r=await window.flowforge.sessionImport(snapshot);if(!r.ok)throw new Error(r.error||"No browser session is running.");setLogs(old=>[...old,`Validated session snapshot for ${snapshot.origin}; import queued.`]);}catch(e){setLogs(old=>[...old,`Session import rejected: ${e instanceof Error?e.message:String(e)}`])}};input.click()};
  const exportWorkflow=()=>{try{const json=JSON.stringify(workflowDocument,null,2);const blob=new Blob([json],{type:"application/json"});const a=document.createElement("a");const url=URL.createObjectURL(blob);a.href=url;a.download=`${workflowName.trim().replace(/[^a-z0-9-_]+/gi,"-")||"workflow"}.flowforge.json`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setLogs(old=>[...old,"Workflow JSON exported."])}catch(e){setLogs(old=>[...old,`Export failed: ${e instanceof Error?e.message:String(e)}`])}};
  const importWorkflow=()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{const doc=normalizeWorkflow(JSON.parse(await f.text()));setWorkflowName(doc.name);setSteps(doc.steps as unknown as Step[]);setStartUrl(doc.startUrl);setBrowser(doc.browser);setGroups(doc.groups);setVariables(doc.variables);setSelected(doc.steps[0]?.id||"");setLogs(old=>[...old,`Imported ${f.name} (${doc.steps.length} steps).`]);}catch(e){setLogs(old=>[...old,`Import rejected: ${e instanceof Error?e.message:String(e)}`])}};input.click()};
  const title=useMemo(()=>current?.name||"No step selected",[current]);
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Zap size={17}/></div><span>flowforge</span><span className="version">DESKTOP</span></div>
      <div className="top-center"><span className="live-dot"/><span>LOCAL AUTOMATION ENGINE</span><span className="top-sep">/</span><span className="muted">{workflowName} · {saveState}</span></div>
      <div className="top-actions"><input aria-label="Recorder URL" className="recorder-url" value={recordUrl} onChange={e=>setRecordUrl(e.target.value)} placeholder="https://example.com" /><button className="icon-button" title="Import workflow" onClick={importWorkflow}><FolderOpen size={16}/></button><button className="icon-button" title="Export workflow" onClick={exportWorkflow}><Save size={16}/></button><button className="icon-button" title="Start visual recorder" onClick={startRecorder} disabled={running}><MousePointer2 size={15}/>{recording?"Recording":"Record"}</button>{recording&&<button className="icon-button" title="Stop recorder" onClick={stopRecorder}><Square size={14}/></button>}<button className="run-button" onClick={run} disabled={running||!validation.valid||steps.length===0}><Play size={14} fill="currentColor"/>{running?"Running":"Run workflow"}</button><button className="stop-button" onClick={()=>window.flowforge.stop()} disabled={!running}><Square size={13} fill="currentColor"/></button></div>
    </header>
    <div className="workspace">
      <aside className="rail">
        <button className={tab==="workflow"?"rail-item active":"rail-item"} onClick={()=>setTab("workflow")}><Layers3 size={18}/><span>Workflow</span></button>
        <button className={tab==="browser"?"rail-item active":"rail-item"} onClick={()=>setTab("browser")}><Globe2 size={18}/><span>Browser</span></button>
        <button className={tab==="profiles"?"rail-item active":"rail-item"} onClick={()=>setTab("profiles")}><Cookie size={18}/><span>Profiles</span></button>
        <button className={tab==="settings"?"rail-item active":"rail-item"} onClick={()=>setTab("settings")}><Settings2 size={18}/><span>Settings</span></button>
        <button className={tab==="history"?"rail-item active":"rail-item"} onClick={()=>setTab("history")}><Clock3 size={18}/><span>Run history</span></button>
        <div className="rail-bottom"><button className="rail-item" onClick={()=>setTab("logs")}><Terminal size={18}/><span>Logs</span></button><div className="engine-badge"><span className="live-dot"/>ENGINE ONLINE</div></div>
      </aside>
      {tab==="workflow" && <>
        <section className="steps-panel">
          <div className="panel-heading"><div><div className="eyebrow">AUTOMATION BUILDER</div><h1>Workflow</h1><p>Build repeatable browser tasks, one step at a time.</p></div><button className="square-button" onClick={()=>addStep()} title="Add step"><Plus size={17}/></button></div>
          <div className="flow-meta"><span><Braces size={13}/> {steps.length} STEPS</span><span><Clock3 size={13}/> SEQUENTIAL</span><button className="text-action" onClick={addGroup}><Plus size={12}/> Group</button></div>
          <div className="workflow-name-wrap"><label className="field-label">Workflow name</label><input className="text-input" value={workflowName} onChange={e=>setWorkflowName(e.target.value)} aria-label="Workflow name"/></div>
          {groups.length>0&&<div className="group-list">{groups.map(g=><div className="group-row" key={g.id}><input className="text-input" value={g.name} aria-label="Group name" onChange={e=>setGroups(all=>all.map(x=>x.id===g.id?{...x,name:e.target.value}:x))}/><button className="tiny-icon always-visible" title="Delete group and ungroup its steps" onClick={()=>{setGroups(all=>all.filter(x=>x.id!==g.id));setSteps(all=>all.map(s=>s.groupId===g.id?({...s,groupId:undefined}):s))}}><Trash2 size={13}/></button></div>)}</div>}
          <div className="step-list">
            {steps.map((s,i)=><div key={s.id} className={`step-card ${s.id===selected?"selected":""}`} onClick={()=>setSelected(s.id)}>
              <div className="step-index">{runState[s.id]==="success"?<Check size={14}/>:runState[s.id]==="running"?<span className="spinner"/>:<span>{String(i+1).padStart(2,"0")}</span>}</div>
              <div className="step-info"><div className="step-name">{s.name}</div><div className="step-sub">{s.type}{s.target?.value?` · ${s.target.strategy}`:""}{s.groupId?` · ${groups.find(g=>g.id===s.groupId)?.name||"Group"}`:""}</div></div>
              <button className="tiny-icon" onClick={e=>{e.stopPropagation();deleteStep(s.id)}} title="Delete step"><Trash2 size={14}/></button>
            </div>)}
          </div>
          <button className="add-step" onClick={()=>addStep()}><Plus size={15}/> Add step</button>
          <div className="panel-footer"><ShieldCheck size={14}/><span>Runs locally on your machine</span></div>
        </section>
        <main className="editor-panel">
          <div className="editor-top"><div><div className="eyebrow">STEP CONFIGURATION</div><h2>{title}</h2></div><div className="editor-tools"><button className="icon-button" onClick={()=>move(-1)} title="Move up"><ArrowUp size={15}/></button><button className="icon-button" onClick={()=>move(1)} title="Move down"><ArrowDown size={15}/></button><button className="icon-button" onClick={duplicateStep} title="Duplicate step"><Copy size={15}/></button></div></div>
          {current?<div className="editor-content">
            <label className="field-label">Step name</label><input className="text-input" value={current.name} onChange={e=>update({name:e.target.value})}/>
            <label className="field-label">Group</label><div className="select-wrap"><select className="text-input" value={current.groupId||""} onChange={e=>update({groupId:e.target.value||undefined})}><option value="">Ungrouped</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><ChevronDown size={14}/></div>
            <label className="field-label">Action type</label><div className="select-wrap"><select className="text-input" value={current.type} onChange={e=>{const type=e.target.value;update({type,name:(stepTypes.find(t=>t[0]===type)?.[1]||type)})}}>{stepTypes.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><ChevronDown size={14}/></div>
            {current.type==="navigate"&&<><label className="field-label">URL</label><input className="text-input" value={current.url||""} onChange={e=>update({url:e.target.value})} placeholder="https://example.com"/></>}
            {["click","type","waitVisible","waitClickable","assertText","select"].includes(current.type)&&<>
              <div className="field-label-row"><label className="field-label">Target locator</label><button className="text-action" onClick={()=>setTab("browser")}><MousePointer2 size={13}/> Record selector</button></div>
              <div className="locator-row"><select className="locator-select" value={current.target?.strategy||"css"} onChange={e=>update({target:{...current.target,strategy:e.target.value}})}>{["xpath","css","id","name","linkText","className","tagName"].map(x=><option key={x}>{x}</option>)}</select><input className="text-input locator-value" value={current.target?.value||""} onChange={e=>update({target:{...current.target,value:e.target.value}})} placeholder="//button[@id='submit']"/></div>
              <div className="hint"><CircleHelp size={13}/> XPath and CSS selectors are supported. Use Record selector to capture a page element.</div>
            </>}
            {current.type==="type"&&<><label className="field-label">Text to type</label><textarea className="text-input textarea" value={current.text||""} onChange={e=>update({text:e.target.value})}/><label className="check-row"><input type="checkbox" checked={current.clearFirst!==false} onChange={e=>update({clearFirst:e.target.checked})}/> Clear field before typing</label></>}
            {current.type==="key"&&<><label className="field-label">Key / shortcut</label><input className="text-input" value={current.key||""} onChange={e=>update({key:e.target.value})} placeholder="ENTER or CONTROL + A"/><div className="hint">Selenium key names are supported, e.g. ENTER, TAB, ESCAPE.</div></>}
            {current.type==="wait"&&<><label className="field-label">Duration (milliseconds)</label><input className="text-input" type="number" value={current.ms||1000} onChange={e=>update({ms:Number(e.target.value)})}/></>}
            {current.type==="assertText"&&<><label className="field-label">Expected text includes</label><input className="text-input" value={current.expected||""} onChange={e=>update({expected:e.target.value})}/></>}
            {current.type==="select"&&<><label className="field-label">Option value</label><input className="text-input" value={current.text||""} onChange={e=>update({text:e.target.value})}/></>}
            {current.type!=="navigate"&&<><label className="field-label">Timeout (ms)</label><input className="text-input" type="number" value={current.timeout||10000} onChange={e=>update({timeout:Number(e.target.value)})}/></>}
            <label className="field-label">On error</label><div className="select-wrap"><select className="text-input" value={current.onError||"stop"} onChange={e=>update({onError:e.target.value})}><option value="stop">Stop workflow</option><option value="continue">Continue to next step</option></select><ChevronDown size={14}/></div>
            <label className="field-label">Retry attempts</label><input className="text-input" aria-label="Retry attempts" type="number" min="1" max="10" value={current.retry?.attempts ?? 1} onChange={e=>{const attempts=Math.max(1,Math.min(10,Number(e.target.value)||1));update({retry:attempts>1||current.retry?{attempts,delayMs:current.retry?.delayMs??500}:undefined})}}/><label className="field-label">Delay between retries (ms)</label><input className="text-input" aria-label="Retry delay in milliseconds" type="number" min="0" max="30000" value={current.retry?.delayMs ?? 500} onChange={e=>update({retry:{attempts:current.retry?.attempts??1,delayMs:Math.max(0,Math.min(30000,Number(e.target.value)||0))}})}/>
            <label className="check-row"><input type="checkbox" checked={!!current.disabled} onChange={e=>update({disabled:e.target.checked})}/> Disable this step</label>
            <div className="editor-bottom"><span><Code2 size={14}/> Selenium WebDriver</span><span>Step ID: {current.id.slice(0,8)}</span></div>
            <section className="variables-panel"><div className="section-caption">WORKFLOW VARIABLES</div><p className="hint">Variables are stored with this workflow. Runtime substitution is planned for the engine phase.</p><button className="secondary-button" onClick={addVariable}><Plus size={12}/> Add variable</button>{variables.map(v=><div className="variable-row" key={v.id}><input className="text-input" value={v.name} aria-label="Variable name" onChange={e=>setVariables(all=>all.map(x=>x.id===v.id?{...x,name:e.target.value}:x))} placeholder="name"/><input className="text-input" value={v.value} aria-label="Variable value" onChange={e=>setVariables(all=>all.map(x=>x.id===v.id?{...x,value:e.target.value}:x))} placeholder="value"/><button className="tiny-icon always-visible" title="Delete variable" onClick={()=>setVariables(all=>all.filter(x=>x.id!==v.id))}><Trash2 size={13}/></button></div>)}</section>
            <section className={`validation-panel ${validation.valid?"is-valid":"has-errors"}`}><div className="validation-title">{validation.valid?"Workflow validation passed":"Workflow needs attention"}</div>{validation.errors.slice(0,8).map((error,i)=><div className="validation-item" key={`${i}-${error}`}>{error}</div>)}{validation.warnings.map((warning,i)=><div className="validation-warning" key={`${i}-${warning}`}>{warning}</div>)}</section>
          </div>:<div className="empty-state">Add a step to begin building your workflow.</div>}
        </main>
        <aside className="right-panel">
          <div className="right-heading"><Activity size={16}/><span>Run status</span><span className="status-pill">{running?"RUNNING":"IDLE"}</span></div>
          <div className="run-summary"><div className="summary-number">{Object.values(runState).filter(s=>s==="success").length}<span>/{steps.length}</span></div><div className="summary-label">steps completed</div><div className="progress"><div style={{width:`${steps.length?Object.values(runState).filter(s=>s==="success").length/steps.length*100:0}%`}}/></div></div>
          <div className="section-caption">BROWSER TARGET</div><div className="browser-select"><AppWindow size={17}/><div><strong>{browser==="chrome"?"Google Chrome":"Microsoft Edge"}</strong><small>Real desktop browser</small></div><ChevronDown size={14}/><select aria-label="Browser" value={browser} onChange={e=>setBrowser(e.target.value)}><option value="chrome">Chrome</option><option value="edge">Edge</option></select></div>
          <div className="section-caption">START URL</div><input className="text-input" value={startUrl} onChange={e=>setStartUrl(e.target.value)} placeholder="https://…"/>
          <div className="section-caption">OPTIMIZATIONS</div><label className="setting-row"><span><strong>Disable images</strong><small>Reduce bandwidth and page load</small></span><input type="checkbox" checked={disableImages} onChange={e=>setDisableImages(e.target.checked)}/></label><label className="setting-row"><span><strong>Disable CSS</strong><small>Experimental, may break layouts</small></span><input type="checkbox" checked={disableCss} onChange={e=>setDisableCss(e.target.checked)}/></label><label className="setting-row"><span><strong>Close browser after run</strong><small>Keep open to inspect results</small></span><input type="checkbox" checked={closeBrowser} onChange={e=>setCloseBrowser(e.target.checked)}/></label>
          <div className="console-head"><span><Terminal size={14}/> ENGINE OUTPUT</span><button className="text-action" onClick={()=>setLogs([])}><Trash2 size={12}/> Clear</button></div><div className="console">{logs.slice(-14).map((l,i)=><div key={i} className="log-line"><span>{String(i+1).padStart(2,"0")}</span><code>{l}</code></div>)}</div>
          <button className="full-run" onClick={run} disabled={running||!validation.valid||steps.length===0}><Play size={14} fill="currentColor"/>{running?"Automation running":"Run automation"}</button>
        </aside>
      </>}
      {tab==="browser"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">LIVE TARGETING</div><h1>Browser & selector</h1><p>Launch a real Chrome or Edge window, then use the selector helper.</p></div></div><div className="feature-card"><div className="feature-icon"><MousePointer2 size={20}/></div><div><h3>Visual record selector</h3><p>The production selector uses a small browser extension/content script to paint a 40% red hover overlay and capture XPath/CSS when you click an element. This starter UI defines the workflow integration point; the extension bridge still needs to be installed and wired.</p><div className="selector-demo"><div className="selector-demo-bar"><span/><span/><span/><code>https://your-site.example</code></div><div className="selector-demo-page"><div className="demo-hover"><b>Hover target preview</b><span>40% red overlay</span></div><div className="demo-lines"><i/><i/><i/></div><button onClick={()=>setLogs(old=>[...old,"Selector bridge is not connected yet. See docs/ROADMAP.md."])}>Capture selected element</button></div></div></div></div><div className="info-grid"><div className="mini-card"><MousePointer2 size={17}/><b>XPath + CSS</b><p>Store a stable locator per action.</p></div><div className="mini-card"><Globe2 size={17}/><b>Actual browser</b><p>Selenium launches installed Chrome or Edge.</p></div><div className="mini-card"><ShieldCheck size={17}/><b>Local-first</b><p>Workflows and profiles stay on this PC.</p></div></div></main>}
      {tab==="profiles"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">IDENTITY & STORAGE</div><h1>Browser profiles</h1><p>Keep browser identity separate between workflows.</p></div><button className="primary-button" onClick={saveProfile}><Save size={14}/> Save profile</button></div><div className="form-card"><label className="field-label">Profile name</label><input className="text-input" value={profileName} onChange={e=>setProfileName(e.target.value)}/><label className="field-label">Browser</label><select className="text-input" value={browser} onChange={e=>setBrowser(e.target.value)}><option value="chrome">Google Chrome</option><option value="edge">Microsoft Edge</option></select><label className="field-label">Persistent user data directory (optional)</label><input className="text-input" value={userDataDir} onChange={e=>setUserDataDir(e.target.value)} placeholder="C:\\FlowForge\\profiles\\work"/><div className="hint"><ShieldCheck size={13}/> For persistent cookies and storage, use a dedicated automation profile directory. Do not point this at a browser profile that is currently open.</div><button className="primary-button" onClick={saveProfile}><Save size={14}/> Save profile settings</button></div><div className="form-card"><div className="section-caption">PORTABLE SESSION SNAPSHOT</div><p className="hint">Export or restore cookies and local/session storage for the current site origin. Start a browser session first. Import navigates to the snapshot origin before restoring state.</p><div className="button-row"><button className="primary-button" onClick={exportSession} disabled={!running}><Save size={14}/> Export session JSON</button><button className="secondary-button" onClick={importSession} disabled={!running}><FolderOpen size={14}/> Import session JSON</button></div><p className="hint"><ShieldCheck size={13}/> Session files contain authentication secrets. They are plain JSON, not encrypted. Store them securely and never commit them to source control. Only one origin is captured per snapshot.</p></div><div className="warning-card">Profile metadata and session snapshots are separate. The snapshot does not include passwords, browser cache, or other origins. Expired cookies are skipped; cookies outside the snapshot host scope are rejected.</div></main>}
      {tab==="settings"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">ENGINE CONFIGURATION</div><h1>Settings</h1><p>Control how the automation engine behaves.</p></div></div><div className="form-card"><div className="setting-row"><span><strong>Disable images</strong><small>Lower bandwidth and speed up page loads.</small></span><input type="checkbox" checked={disableImages} onChange={e=>setDisableImages(e.target.checked)}/></div><div className="setting-row"><span><strong>Disable CSS</strong><small>Experimental. Best implemented through CDP request interception.</small></span><input type="checkbox" checked={disableCss} onChange={e=>setDisableCss(e.target.checked)}/></div><div className="setting-row"><span><strong>Close browser after run</strong><small>Close WebDriver session when the workflow finishes.</small></span><input type="checkbox" checked={closeBrowser} onChange={e=>setCloseBrowser(e.target.checked)}/></div><label className="field-label">Default browser</label><select className="text-input" value={browser} onChange={e=>setBrowser(e.target.value)}><option value="chrome">Chrome</option><option value="edge">Edge</option></select></div></main>}
      {tab==="history"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">EXECUTION DIAGNOSTICS</div><h1>Run history</h1><p>Recent automation outcomes are stored locally on this device.</p></div><button className="secondary-button" onClick={()=>{setRunHistory([]);activeRunId.current=null}}>Clear history</button></div>{runHistory.length===0?<div className="empty-state">No runs recorded yet. Run a workflow to start building history.</div>:<div className="history-list">{runHistory.map(item=><article className="form-card" key={item.id}><div className="history-title-row"><strong>{item.workflow}</strong><span className={`status-pill ${item.status}`}>{item.status.toUpperCase()}</span></div><div className="hint">Started {new Date(item.startedAt).toLocaleString()} · {item.durationMs===undefined?"In progress":`${(item.durationMs/1000).toFixed(1)}s`}</div><div className="history-stats"><span>{item.successfulSteps} succeeded</span><span>{item.failedSteps} failed</span><span>{item.skippedSteps} skipped</span><span>{item.totalSteps} total</span></div>{item.error&&<div className="validation-item">{item.error}</div>}</article>)}</div>}</main>}
      {tab==="logs"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">DIAGNOSTICS</div><h1>Engine logs</h1><p>Live output from the local Selenium runner.</p></div><button className="secondary-button" onClick={()=>setLogs([])}>Clear logs</button></div><div className="console large-console">{logs.map((l,i)=><div key={i} className="log-line"><span>{String(i+1).padStart(3,"0")}</span><code>{l}</code></div>)}</div></main>}
    </div>
    <footer className="statusbar"><span><span className="live-dot"/> Ready</span><span>SELENIUM WEBDRIVER <b>·</b> REACT <b>·</b> ELECTRON</span><span>v0.1.0</span></footer>
  </div>
}