import { useEffect, useRef } from "react";
import { Archive, Columns3, Eraser, FileDown, FileUp, Fingerprint, History, LayoutTemplate, Languages, LibraryBig, Maximize2, MousePointerClick, MousePointer2, PanelBottom, PanelLeft, PanelRight, Play, Plus, RotateCcw, Settings, Sparkles, Square, Sun, Terminal, Type, Variable, Workflow, MessageSquareText } from "lucide-react";
import { useAppController } from "./state/useAppController";
import { usePanelLayout } from "./state/usePanelLayout";
import { Topbar } from "./layout/Topbar";
import { NavSidebar } from "./layout/NavSidebar";
import { StatusBar } from "./layout/StatusBar";
import { EditorView } from "./editor/EditorView";
import { VariablesView } from "./views/VariablesView";
import { LibraryView } from "./views/LibraryView";
import { OutputsView } from "./views/OutputsView";
import { TemplatesView } from "./views/TemplatesView";
import { BrowserView } from "./views/BrowserView";
import { ProfilesView } from "./views/ProfilesView";
import { SettingsView } from "./views/SettingsView";
import { HistoryView } from "./views/HistoryView";
import { LogsView } from "./views/LogsView";
import AIStudio from "./AIStudio";
import { CommandPalette, type PaletteCommand } from "./dialogs/CommandPalette";
import { UserInputDialog } from "./dialogs/UserInputDialog";
import { UpdateDialog } from "./dialogs/UpdateDialog";

/* Maintainer: Amirreza Taati (Jelofen1962) | https://github.com/Jelofen1962 | https://t.me/Jelofen1962 */

/** Composition root: state lives in useAppController, layout in usePanelLayout, everything else is presentational. */
export default function App() {
  const app = useAppController();
  const panels = usePanelLayout();
  const { t, tab, theme, language } = app;

  // The theme lives on <html> so portals (popovers) inherit the same tokens.
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // Bring the console into view when a run starts.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (app.running && !wasRunning.current) panels.reveal("dock");
    wasRunning.current = app.running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.running]);

  // Layout shortcuts use physical key codes so they work on any keyboard layout (including Persian).
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const api = panelsRef.current;
      const actions: Record<string, () => void> = {
        KeyB: api.toggleNav,
        BracketLeft: () => api.toggleOpen("steps"),
        BracketRight: () => api.toggleOpen("run"),
        KeyJ: () => api.toggleOpen("dock"),
        Backslash: api.toggleFocus,
      };
      const action = actions[event.code];
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const closePalette = () => { app.setCommandOpen(false); app.setCommandQuery(""); };
  const go = (id: string) => () => app.setTab(id);
  const inEditor = (action: () => void) => () => { app.setTab("workflow"); action(); };

  const commands: PaletteCommand[] = [
    { id: "run", group: "Workflow", label: "Run workflow", detail: "Execute the current workflow", icon: Play, run: () => void app.run() },
    { id: "stop", group: "Workflow", label: "Stop workflow", detail: "Request the running browser to stop", icon: Square, run: () => void window.flowforge.stop() },
    { id: "new", group: "Workflow", label: "New workflow", detail: "Start with one navigation step", icon: Plus, run: app.newWorkflow },
    { id: "add-click", group: "Workflow", label: "Add click step", detail: "Insert a click action", icon: MousePointerClick, run: () => app.addStep("click") },
    { id: "add-type", group: "Workflow", label: "Add type step", detail: "Insert a type-text action", icon: Type, run: () => app.addStep("type") },
    { id: "add-input", group: "Workflow", label: "Add user input step", detail: "Prompt the user and fill mapped webpage elements", icon: MessageSquareText, run: () => app.addStep("userInput") },
    { id: "import", group: "Workflow", label: "Import workflow", detail: "Open a FlowForge JSON file", icon: FileUp, run: app.importWorkflow },
    { id: "export", group: "Workflow", label: "Export workflow", detail: "Save the current workflow as JSON", icon: FileDown, run: app.exportWorkflow },
    { id: "go-editor", group: "Go to", label: "Open editor", detail: "Build and edit workflow steps", icon: Workflow, run: go("workflow") },
    { id: "go-variables", group: "Go to", label: "Open variables", detail: "Manage values used by this workflow", icon: Variable, run: go("variables") },
    { id: "go-library", group: "Go to", label: "Open workflow library", detail: "Manage, duplicate, import and share workflows", icon: LibraryBig, run: go("library") },
    { id: "go-outputs", group: "Go to", label: "Open workflow outputs", detail: "Preview, open, or delete this workflow's output ZIP archives", icon: Archive, run: go("outputs") },
    { id: "go-templates", group: "Go to", label: "Open templates", detail: "Browse reusable workflow starters", icon: LayoutTemplate, run: go("templates") },
    { id: "go-browser", group: "Go to", label: "Open browser", detail: "Browser and selector information", icon: MousePointer2, run: go("browser") },
    { id: "go-profiles", group: "Go to", label: "Open profiles", detail: "Browser profile and session tools", icon: Fingerprint, run: go("profiles") },
    { id: "go-settings", group: "Go to", label: "Open settings", detail: "Performance and browser settings", icon: Settings, run: go("settings") },
    { id: "go-history", group: "Go to", label: "Open run history", detail: "Review recent execution outcomes", icon: History, run: go("history") },
    { id: "go-logs", group: "Go to", label: "Open logs", detail: "View engine diagnostics", icon: Terminal, run: go("logs") },
    { id: "go-ai", group: "Go to", label: "Open AI Studio", detail: "Connect an AI agent and explore workflow graphs", icon: Sparkles, run: go("ai") },
    { id: "v-steps", group: "View", label: "Toggle steps panel", detail: "Show or hide the workflow steps", icon: PanelLeft, shortcut: "Ctrl [", run: inEditor(() => panels.toggleOpen("steps")) },
    { id: "v-run", group: "View", label: "Toggle run status panel", detail: "Show or hide run controls and environment", icon: PanelRight, shortcut: "Ctrl ]", run: inEditor(() => panels.toggleOpen("run")) },
    { id: "v-dock", group: "View", label: "Toggle console", detail: "Show or hide live engine output", icon: PanelBottom, shortcut: "Ctrl J", run: inEditor(() => panels.toggleOpen("dock")) },
    { id: "v-nav", group: "View", label: "Toggle navigation sidebar", detail: "Collapse the sidebar to icons or expand it", icon: Columns3, shortcut: "Ctrl B", run: panels.toggleNav },
    { id: "v-focus", group: "View", label: "Focus mode", detail: "Hide every side panel to focus on the step", icon: Maximize2, shortcut: "Ctrl \\", run: inEditor(panels.toggleFocus) },
    { id: "v-reset", group: "View", label: "Reset layout", detail: "Restore default panel sizes and visibility", icon: RotateCcw, run: panels.resetLayout },
    { id: "v-theme", group: "View", label: "Toggle theme", detail: "Switch between dark and light", icon: Sun, run: () => app.setTheme(v => (v === "dark" ? "light" : "dark")) },
    { id: "v-lang", group: "View", label: "Switch language", detail: "Switch between English and Persian", icon: Languages, run: () => app.setLanguage(v => (v === "en" ? "fa" : "en")) },
    { id: "v-clear", group: "View", label: "Clear console", detail: "Remove all engine output lines", icon: Eraser, run: () => app.setLogs([]) },
  ];

  const skip = (event: React.MouseEvent) => { event.preventDefault(); document.getElementById("main")?.focus(); };

  return (
    <div className="app" data-theme={theme} data-language={language} dir={language === "fa" ? "rtl" : "ltr"} lang={language}>
      <a className="skip-link" href="#main" onClick={skip}>{t("Skip to content")}</a>
      <Topbar app={app} panels={panels} onOpenPalette={() => { app.setCommandOpen(true); app.setCommandQuery(""); }} />
      <div className="app-body">
        <NavSidebar app={app} panels={panels} />
        {tab === "workflow" && <EditorView app={app} panels={panels} />}
        {tab === "ai" && (
          <AIStudio
            t={t}
            workflows={app.workflowLibrary}
            onOpenWorkflow={id => { const item = app.workflowLibrary.find(w => w.id === id); if (item) app.activateWorkflow(item); }}
            onTagWorkflow={(id, provenance) => app.setWorkflowLibrary(all => all.map(item => (item.id === id ? { ...item, aiTag: true, aiProvenance: provenance, updatedAt: new Date().toISOString() } : item)))}
          />
        )}
        {tab === "variables" && <VariablesView app={app} />}
        {tab === "library" && <LibraryView app={app} />}
        {tab === "outputs" && <OutputsView app={app} />}
        {tab === "templates" && <TemplatesView app={app} />}
        {tab === "browser" && <BrowserView app={app} />}
        {tab === "profiles" && <ProfilesView app={app} />}
        {tab === "settings" && <SettingsView app={app} />}
        {tab === "history" && <HistoryView app={app} />}
        {tab === "logs" && <LogsView app={app} />}
      </div>
      <StatusBar app={app} panels={panels} />
      <UserInputDialog app={app} />
      <UpdateDialog app={app} />
      <CommandPalette open={app.commandOpen} onClose={closePalette} t={t} commands={commands} query={app.commandQuery} onQuery={app.setCommandQuery} />
    </div>
  );
}

