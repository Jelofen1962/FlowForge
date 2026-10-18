// @vitest-environment jsdom
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../src/ui/App";

/** Minimal in-memory stand-in for the Electron preload bridge. */
function installBridge() {
  const noop = () => () => {};
  const ok = async () => ({ ok: true });
  const bridge: Record<string, unknown> = {
    getVersion: async () => "9.9.9",
    getAiApiInfo: async () => ({ available: true, baseUrl: "http://127.0.0.1:1", token: "abcdefghijklmnop", authHeader: "Authorization", docsPath: "/docs" }),
    getAiProviderSettings: async () => ({ baseUrl: "http://localhost:20128/v1", model: "MCP", hasApiKey: false }),
    getAiGuidanceActions: async () => [],
    syncAiWorkflows: ok,
    checkForUpdates: async () => ({ ok: true, available: false }),
    listProfiles: async () => [],
    listSessions: async () => [],
    listOutputs: async () => [],
    onAiWorkflowUpsert: noop,
    onLog: noop,
    onFinished: noop,
  };
  (window as unknown as { flowforge: unknown }).flowforge = new Proxy(bridge, {
    get: (target, key: string) => target[key] ?? (key.startsWith("on") ? noop : ok),
  });
}

beforeEach(() => {
  localStorage.clear();
  installBridge();
});

const runAxe = async (node: Element) =>
  axe.run(node, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } }, resultTypes: ["violations"] });

describe("App shell", () => {
  it("renders the editor workspace with navigation, panels and status bar", async () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize workflow steps panel" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Steps" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Run status" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Console" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("hides and restores panels from the status bar, and reflects state with aria-pressed", () => {
    render(<App />);
    const toggles = within(screen.getByRole("group", { name: "Panels" }));
    const steps = toggles.getByRole("button", { name: /^Steps/ });
    expect(steps).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(steps);
    expect(screen.queryByRole("region", { name: "Steps" })).toBeNull();
    expect(steps).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(steps);
    expect(screen.getByRole("region", { name: "Steps" })).toBeInTheDocument();
  });

  it("collapses a panel to a rail and expands it again", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse Run status" }));
    expect(screen.getByRole("button", { name: "Expand Run status" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand Run status" }));
    expect(screen.getByRole("button", { name: "Collapse Run status" })).toBeInTheDocument();
  });

  it("supports layout keyboard shortcuts (Ctrl+J toggles the console, Ctrl+\\ focus mode)", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "j", code: "KeyJ", ctrlKey: true });
    expect(screen.queryByRole("region", { name: "Console" })).toBeNull();
    fireEvent.keyDown(window, { key: "j", code: "KeyJ", ctrlKey: true });
    expect(screen.getByRole("region", { name: "Console" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "\\", code: "Backslash", ctrlKey: true });
    expect(screen.queryByRole("region", { name: "Steps" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Run status" })).toBeNull();
  });

  it("collapses the navigation sidebar to icons while keeping accessible names", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toHaveClass("nav-collapsed");
  });

  it("navigates between pages and marks the current one", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Variables" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Variables" })).toBeInTheDocument();
  });

  it("opens the command palette with Ctrl+K and runs a command with the keyboard", async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("combobox");
    fireEvent.change(input, { target: { value: "open settings" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switches theme and language", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
  });

  it("adds a step from the steps panel", () => {
    render(<App />);
    const before = within(screen.getByRole("list", { name: "Workflow steps" })).getAllByRole("listitem").length;
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    expect(within(screen.getByRole("list", { name: "Workflow steps" })).getAllByRole("listitem").length).toBe(before + 1);
  });
});

describe("accessibility (axe-core)", () => {
  it("editor workspace has no serious or critical violations", async () => {
    const { container } = render(<App />);
    const results = await runAxe(container);
    const bad = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
    expect(bad.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  for (const page of ["Variables", "Workflows", "Outputs", "Templates", "Browser", "Profiles", "Settings", "Run history", "Logs", "AI Studio"]) {
    it(`${page} page has no serious or critical violations`, async () => {
      const { container } = render(<App />);
      fireEvent.click(screen.getByRole("button", { name: page }));
      await screen.findByRole("heading", { level: 1 });
      const results = await runAxe(container);
      const bad = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
      expect(bad.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
});
