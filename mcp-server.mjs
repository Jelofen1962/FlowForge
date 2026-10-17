import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const baseUrl = (process.env.FLOWFORGE_API_URL || "http://127.0.0.1:43127").replace(/\/+$/, "");
const token = process.env.FLOWFORGE_API_TOKEN;
if (!token) {
  console.error("Set FLOWFORGE_API_TOKEN to the local token shown in FlowForge → AI Studio.");
  process.exit(1);
}
async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `FlowForge API returned HTTP ${response.status}`);
  return data;
}
const output = value => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const server = new McpServer({ name: "flowforge", version: "1.0.0" });

server.tool("flowforge_list_workflows", "List workflows in the user's local FlowForge library. Use this before creating duplicate work.", {}, async () => output(await api("/v1/workflows")));
server.tool("flowforge_get_workflow_graph", "Inspect workflow nodes and nested workflow dependencies.", {}, async () => output(await api("/v1/workflow-graph")));
server.tool("flowforge_get_workflow", "Get the complete workflow definition by its exact local workflow ID.", { id: z.string().min(1) }, async ({ id }) => output(await api(`/v1/workflows/${encodeURIComponent(id)}`)));
server.tool("flowforge_get_recorded_actions", "Read recent non-sensitive browser actions captured by FlowForge's passive recorder. Review selectors and values before reusing them.", {}, async () => output(await api("/v1/guidance/actions")));
server.tool("flowforge_start_recorder", "Start a visible browser recorder so the user can demonstrate a task. Ask the user to perform the needed actions, then inspect recorded actions before building a workflow.", { startUrl: z.string().url().optional(), browser: z.enum(["chrome", "edge"]).optional() }, async ({ startUrl, browser }) => output(await api("/v1/recorder/start", { method: "POST", body: JSON.stringify({ startUrl, browser }) })));
server.tool("flowforge_stop_recorder", "Stop the active browser recorder and finalize the captured actions for review.", {}, async () => output(await api("/v1/recorder/stop")));
server.tool("flowforge_create_workflow", "Create an AI-tagged workflow in the local library. Validate the workflow definition and use existing workflows as nested subflows where useful.", { workflow: z.record(z.unknown()) }, async ({ workflow }) => output(await api("/v1/workflows", { method: "POST", body: JSON.stringify({ workflow }) })));
server.tool("flowforge_update_workflow", "Update an existing workflow by ID. This is a real local change; preserve unrelated steps and validate the complete definition first.", { id: z.string().min(1), workflow: z.record(z.unknown()) }, async ({ id, workflow }) => output(await api(`/v1/workflows/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ workflow }) })));
server.tool("flowforge_start_run", "Start a workflow already stored in FlowForge by supplying its workflow object from flowforge_get_workflow. This controls a real browser. Only execute tasks the user requested.", { workflow: z.record(z.unknown()) }, async ({ workflow }) => output(await api("/v1/runs", { method: "POST", body: JSON.stringify({ workflow }) })));
server.tool("flowforge_get_active_run", "Get current execution state and recent logs, including whether the run is waiting for user input.", {}, async () => output(await api("/v1/runs/active")));
server.tool("flowforge_stop_run", "Stop the active browser run when the user requests cancellation or execution must be safely halted.", {}, async () => output(await api("/v1/runs/stop", { method: "POST", body: "{}" })));
server.tool("flowforge_submit_user_guidance", "Resume a paused run by submitting the exact requestId and user's answers. Do not send passwords or other secrets unless the runtime explicitly requires them; never save secrets as workflow steps.", {
  requestId: z.string().min(1),
  values: z.record(z.string()),
  cancel: z.boolean().optional()
}, async ({ requestId, values, cancel }) => output(await api("/v1/runs/input", { method: "POST", body: JSON.stringify({ requestId, values, cancel }) })));
const transport = new StdioServerTransport();
await server.connect(transport);
