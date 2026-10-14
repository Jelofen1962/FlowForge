import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Keep all Rust command-name mapping here.
 * Adjust these names/argument shapes to match src-tauri/src/commands.rs.
 * UI remains usable in browser preview when running outside the Tauri shell.
 */
export const backend = {
  async available() {
    return isTauri();
  },
  async listBrowsers(): Promise<unknown> {
    if (!isTauri()) return [];
    return invoke("discover_browsers");
  },
  async launchBrowser(browser?: string): Promise<unknown> {
    if (!isTauri()) throw new Error("Launch a CobWeb desktop build to control a local browser.");
    return invoke("launch_browser", { browser });
  },
  async runWorkflow(workflow: unknown): Promise<unknown> {
    if (!isTauri()) throw new Error("Workflow execution requires the CobWeb desktop backend.");
    return invoke("run_workflow", { workflow });
  }
};
