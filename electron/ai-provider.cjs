const fs = require('node:fs/promises');
const path = require('node:path');

const toolSpecs = [
  { type: 'function', function: { name: 'flowforge_list_workflows', description: 'List saved FlowForge workflows.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'flowforge_get_workflow_graph', description: 'Get workflow dependency graph.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'flowforge_get_workflow', description: 'Get a workflow by ID.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } } },
  { type: 'function', function: { name: 'flowforge_get_recorded_actions', description: 'Read recent non-sensitive recorded browser actions.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'flowforge_start_run', description: 'Start a workflow using its full workflow definition. This controls a real browser; only do this when requested by the user.', parameters: { type: 'object', properties: { workflow: { type: 'object', additionalProperties: true } }, required: ['workflow'], additionalProperties: false } } },
  { type: 'function', function: { name: 'flowforge_get_active_run', description: 'Get active run state and logs.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'flowforge_stop_run', description: 'Stop active browser run.', parameters: { type: 'object', properties: {}, additionalProperties: false } } }
];

function createAiProvider({ userDataPath, apiBaseUrl, apiToken, getApiInfo }) {
  const settingsPath = path.join(userDataPath, 'ai-provider.json');
  const defaults = { baseUrl: 'http://localhost:20128/v1', model: 'MCP', apiKey: '' };
  async function getSettings() {
    try { const saved = JSON.parse(await fs.readFile(settingsPath, 'utf8')); return { ...defaults, ...saved }; }
    catch { return { ...defaults }; }
  }
  async function saveSettings(input) {
    if (!input || typeof input !== 'object') throw new Error('Invalid provider settings.');
    const baseUrl = String(input.baseUrl || '').trim().replace(/\/+$/, '');
    const model = String(input.model || '').trim();
    const apiKey = String(input.apiKey || '').trim();
    let parsed; try { parsed = new URL(baseUrl); } catch { throw new Error('Enter a valid API base URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('API URL must use HTTP or HTTPS.');
    if (!model) throw new Error('Enter a model identifier.');
    const current = await getSettings();
    const next = { baseUrl, model, apiKey: apiKey || current.apiKey };
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(next, null, 2), { mode: 0o600 });
    return { ok: true, baseUrl: next.baseUrl, model: next.model, hasApiKey: !!next.apiKey };
  }
  async function callTool(name, args) {
    const headers = { Authorization: `Bearer ${apiToken()}`, 'Content-Type': 'application/json' };
    const call = async (url, options = {}) => {
      const r = await fetch(`${apiBaseUrl()}${url}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
      const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || `FlowForge tool returned HTTP ${r.status}`); return data;
    };
    switch (name) {
      case 'flowforge_list_workflows': return call('/v1/workflows');
      case 'flowforge_get_workflow_graph': return call('/v1/workflow-graph');
      case 'flowforge_get_workflow': return call(`/v1/workflows/${encodeURIComponent(String(args.id || ''))}`);
      case 'flowforge_get_recorded_actions': return call('/v1/guidance/actions');
      case 'flowforge_start_run': return call('/v1/runs', { method: 'POST', body: JSON.stringify({ workflow: args.workflow }) });
      case 'flowforge_get_active_run': return call('/v1/runs/active');
      case 'flowforge_stop_run': return call('/v1/runs/stop', { method: 'POST', body: '{}' });
      default: throw new Error(`Tool not allowed: ${name}`);
    }
  }
  async function chat(input) {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error('Add your 9Router API key in AI Studio settings first.');
    const messages = [
      { role: 'system', content: 'You are FlowForge, a careful browser automation assistant. Use FlowForge tools to inspect workflows before acting. Only run browser automation when the user explicitly asks. Explain meaningful actions. Never ask the user to share passwords, OTPs, or secrets in chat. Do not claim an action succeeded unless a tool result confirms it.' },
      { role: 'user', content: String(input.message || '').slice(0, 12000) }
    ];
    const url = `${settings.baseUrl}/chat/completions`;
    for (let round = 0; round < 6; round++) {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: settings.model, messages, tools: toolSpecs, tool_choice: 'auto', temperature: 0.2 }), signal: AbortSignal.timeout(90000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.message || `9Router returned HTTP ${response.status}`);
      const message = payload.choices?.[0]?.message;
      if (!message) throw new Error('The provider returned no assistant message. Check the model ID and API compatibility.');
      messages.push(message);
      const calls = message.tool_calls || [];
      if (!calls.length) return { ok: true, text: message.content || '', toolCalls: round };
      for (const toolCall of calls) {
        const name = toolCall.function?.name;
        let args = {}; try { args = JSON.parse(toolCall.function?.arguments || '{}'); } catch { throw new Error(`Model returned invalid arguments for ${name || 'tool'}.`); }
        let result;
        try { result = await callTool(name, args); }
        catch (error) { result = { error: error instanceof Error ? error.message : String(error) }; }
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result).slice(0, 30000) });
      }
    }
    throw new Error('Stopped after six tool-call rounds to prevent an endless agent loop.');
  }
  return { getSettings, saveSettings, chat };
}
module.exports = { createAiProvider };
