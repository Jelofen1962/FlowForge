const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
  res.end(body);
}
function createAiApi({ userDataPath, getWorkflows, startWorkflow, getRunState, respondUserInput, saveWorkflow, getGuidanceActions, startRecorder, stopRecorder, stopWorkflow }) {
  let token = "";
  let server;
  async function start() {
    const tokenPath = path.join(userDataPath, "ai-api-token");
    try { token = (await fs.readFile(tokenPath, "utf8")).trim(); } catch {}
    if (!/^[a-f0-9]{64}$/.test(token)) {
      token = crypto.randomBytes(32).toString("hex");
      await fs.writeFile(tokenPath, token, { mode: 0o600 });
    }
    server = http.createServer(async (req, res) => {
      // Only bind to loopback and require a bearer token for every API request.
      if (!req.socket.remoteAddress || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) return send(res, 403, { error: "Loopback access only." });
      if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { error: "Missing or invalid bearer token." });
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/v1/health") return send(res, 200, { ok: true, service: "FlowForge AI API", version: 1 });
      if (req.method === "GET" && url.pathname === "/v1/workflows") return send(res, 200, { workflows: getWorkflows().map(w => ({ id: w.id, name: w.document.name, startUrl: w.document.startUrl, browser: w.document.browser, stepCount: w.document.steps.length, aiTag: !!w.aiTag, updatedAt: w.updatedAt })) });
      if (req.method === "GET" && url.pathname === "/v1/guidance/actions") return send(res, 200, { actions: getGuidanceActions().slice(-500) });
      if (req.method === "POST" && url.pathname === "/v1/recorder/start") {
        let body = {};
        try { let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 20_000) throw new Error("Request body too large."); } body = JSON.parse(raw || "{}"); }
        catch (e) { return send(res, 400, { error: e instanceof Error ? e.message : "Invalid JSON." }); }
        const result = await startRecorder(body);
        return send(res, result.ok ? 202 : 409, result);
      }
      if (req.method === "POST" && url.pathname === "/v1/recorder/stop") {
        const result = await stopRecorder();
        return send(res, result.ok ? 200 : 409, result);
      }
      if (req.method === "POST" && url.pathname === "/v1/workflows") {
        let body;
        try { let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) throw new Error("Workflow exceeds 2 MB."); } body = JSON.parse(raw || "{}"); }
        catch (e) { return send(res, 400, { error: e instanceof Error ? e.message : "Invalid JSON." }); }
        const result = await saveWorkflow(null, body.workflow || body);
        return send(res, result.ok ? 201 : 400, result);
      }
      const updateId = req.method === "PUT" && url.pathname.startsWith("/v1/workflows/") ? url.pathname.slice("/v1/workflows/".length) : "";
      if (updateId && !updateId.includes("/")) {
        let body;
        try { let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) throw new Error("Workflow exceeds 2 MB."); } body = JSON.parse(raw || "{}"); }
        catch (e) { return send(res, 400, { error: e instanceof Error ? e.message : "Invalid JSON." }); }
        const result = await saveWorkflow(decodeURIComponent(updateId), body.workflow || body);
        return send(res, result.ok ? 200 : 400, result);
      }
      if (req.method === "GET" && url.pathname === "/v1/workflow-graph") {
        const workflows = getWorkflows();
        const nodes = workflows.map(w => ({ id: w.id, name: w.document.name, aiTag: !!w.aiTag, stepCount: w.document.steps.length }));
        const edges = [];
        for (const w of workflows) for (const step of w.document.steps || []) if (step.type === "runWorkflow" && step.workflowId) edges.push({ source: w.id, target: step.workflowId, stepId: step.id, stepName: step.name });
        return send(res, 200, { nodes, edges });
      }
      if (req.method === "GET" && url.pathname.startsWith("/v1/workflows/")) {
        const id = decodeURIComponent(url.pathname.slice("/v1/workflows/".length));
        const w = getWorkflows().find(item => item.id === id);
        return w ? send(res, 200, { workflow: w }) : send(res, 404, { error: "Workflow not found." });
      }
      if (req.method === "GET" && url.pathname === "/v1/runs/active") return send(res, 200, getRunState());
      if (req.method === "POST" && url.pathname === "/v1/runs/stop") {
        const result = await stopWorkflow();
        return send(res, result.ok ? 200 : 409, result);
      }
      if (req.method === "POST" && url.pathname === "/v1/runs") {
        let body;
        try {
          let raw = "";
          for await (const chunk of req) { raw += chunk; if (raw.length > 5_000_000) throw new Error("Request body exceeds 5 MB."); }
          body = JSON.parse(raw || "{}");
        } catch (e) { return send(res, 400, { error: e instanceof Error ? e.message : "Invalid JSON." }); }
        if (!body || typeof body !== "object" || !body.workflow || typeof body.workflow !== "object") return send(res, 400, { error: "Provide a workflow object." });
        const result = await startWorkflow(body.workflow);
        return send(res, result.ok ? 202 : 409, result);
      }
      if (req.method === "POST" && url.pathname === "/v1/runs/input") {
        let body;
        try { let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error("Input exceeds 100 KB."); } body = JSON.parse(raw || "{}"); }
        catch (e) { return send(res, 400, { error: e instanceof Error ? e.message : "Invalid JSON." }); }
        if (!body || typeof body.requestId !== "string" || !body.values || typeof body.values !== "object" || Array.isArray(body.values)) return send(res, 400, { error: "requestId and values are required." });
        const result = await respondUserInput({ requestId: body.requestId, values: body.values, cancel: !!body.cancel });
        return send(res, result.ok ? 200 : 409, result);
      }
      return send(res, 404, { error: "Unknown endpoint." });
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(43127, "127.0.0.1", resolve); });
  }
  async function stop() { if (server) await new Promise(resolve => server.close(resolve)); server = null; }
  function info() { return { available: !!server?.listening, baseUrl: "http://127.0.0.1:43127", token, authHeader: "Authorization: Bearer <token>", docsPath: "/v1/health" }; }
  return { start, stop, info };
}
module.exports = { createAiApi };
