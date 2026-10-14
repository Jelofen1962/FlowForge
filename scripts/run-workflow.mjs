import { chromium } from '@playwright/test';
import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const iterator = input[Symbol.asyncIterator]();
const first = await iterator.next();
if (first.done) process.exit(2);
let request;
try { request = JSON.parse(first.value); }
catch { process.stdout.write(JSON.stringify({ event: 'finished', result: { ok: false, error: 'Invalid workflow request JSON.', logs: [] } }) + '\n'); process.exit(2); }

const port = Number(request.port || 9222);
const defaultTimeout = Math.min(120000, Math.max(100, Number(request.timeout || 10000)));
const runId = String(request.runId || 'unknown');
const logs = [];
let paused = false;
let cancelled = false;
let pauseResolver;
let cancelResolver;
const cancellation = new Promise(resolve => { cancelResolver = resolve; });
const send = payload => process.stdout.write(JSON.stringify({ runId, ...payload }) + '\n');
const log = (step, status, message) => {
  const entry = { step: step?.id ?? null, title: step?.title ?? 'Browser', status, message, at: new Date().toISOString() };
  logs.push(entry);
  send({ event: 'log', log: entry });
};
const selectorFrom = (detail = '') => {
  const raw = String(detail).trim().replace(/^css:\s*/i, '');
  const split = raw.split(/\s+[·|]\s+|\s+·\s+|\s+\u00b7\s+/)[0].trim();
  if (!split || /^(select an element|css selector)$/i.test(split)) throw new Error('Configure a CSS selector in the step settings.');
  return split;
};
const valueFrom = (detail = '') => {
  const quoted = String(detail).match(/[“"]([^”]*)[”"]/);
  if (quoted) return quoted[1];
  const pieces = String(detail).split(/\s+[·|]\s+/);
  return pieces.length > 1 ? pieces.slice(1).join(' · ').trim() : '';
};
const waitIfPaused = async step => {
  while (paused && !cancelled) { send({ event: 'state', state: 'paused', step: step?.id ?? null, title: step?.title ?? null }); await new Promise(resolve => { pauseResolver = resolve; }); }
  if (cancelled) throw new Error('Workflow cancelled by user.');
};
const cancellable = async operation => Promise.race([
  Promise.resolve().then(operation),
  cancellation.then(() => { throw new Error('Workflow cancelled by user.'); }),
]);
input.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.runId && message.runId !== runId) return;
  if (message.action === 'pause') { paused = true; send({ event: 'state', state: 'pause-pending', step: message.step ?? null }); }
  if (message.action === 'resume') { paused = false; pauseResolver?.(); pauseResolver = undefined; send({ event: 'state', state: 'running' }); }
  if (message.action === 'stop') { cancelled = true; paused = false; pauseResolver?.(); cancelResolver?.(); send({ event: 'state', state: 'cancelling' }); }
});

let browser;
let page;
let finalResult;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: defaultTimeout });
  const context = browser.contexts()[0] ?? await browser.newContext();
  page = context.pages()[0] ?? await context.newPage();
  if (request.startingUrl && page.url() === 'about:blank') await cancellable(() => page.goto(request.startingUrl, { waitUntil: 'domcontentloaded', timeout: defaultTimeout }));
  send({ event: 'state', state: 'running' });
  for (const step of request.steps ?? []) {
    if (cancelled) break;
    await waitIfPaused(step);
    if (cancelled) break;
    if (!step.enabled) { log(step, 'skipped', 'Step is disabled.'); continue; }
    if (step.breakpoint && request.liveDebugging !== false) {
      paused = true;
      send({ event: 'state', state: 'paused', step: step.id, title: step.title, reason: 'breakpoint' });
      await waitIfPaused(step);
    }
    if (cancelled) break;
    send({ event: 'step-start', step: { id: step.id, title: step.title, type: step.type } });
    try {
      const detail = String(step.detail ?? '');
      const selector = () => selectorFrom(detail);
      const locator = () => page.locator(selector()).first();
      const timeout = Math.min(120000, Math.max(100, Number(step.timeout || defaultTimeout)));
      const action = async () => {
        switch (step.type) {
          case 'navigate': await page.goto(detail.trim() || request.startingUrl, { waitUntil: 'domcontentloaded', timeout }); break;
          case 'back': await page.goBack({ waitUntil: 'domcontentloaded', timeout }); break;
          case 'forward': await page.goForward({ waitUntil: 'domcontentloaded', timeout }); break;
          case 'reload': await page.reload({ waitUntil: 'domcontentloaded', timeout }); break;
          case 'wait': case 'waitUntil': await locator().waitFor({ state: 'visible', timeout }); break;
          case 'delay': { const ms = Number(detail.match(/\d+/)?.[0] ?? 1000); await page.waitForTimeout(Math.min(120000, Math.max(0, ms))); break; }
          case 'click': await locator().click({ timeout }); break;
          case 'doubleClick': await locator().dblclick({ timeout }); break;
          case 'rightClick': await locator().click({ button: 'right', timeout }); break;
          case 'hover': await locator().hover({ timeout }); break;
          case 'type': await locator().pressSequentially(valueFrom(detail), { timeout }); break;
          case 'fill': await locator().fill(valueFrom(detail), { timeout }); break;
          case 'clear': await locator().fill('', { timeout }); break;
          case 'press': await locator().press(valueFrom(detail) || 'Enter', { timeout }); break;
          case 'select': await locator().selectOption(valueFrom(detail), { timeout }); break;
          case 'check': await locator().check({ timeout }); break;
          case 'visibleAssert': await locator().waitFor({ state: 'visible', timeout }); break;
          case 'textAssert': { const expected = valueFrom(detail); const actual = await locator().innerText({ timeout }); if (!actual.includes(expected)) throw new Error(`Expected text to include “${expected}”; received “${actual.slice(0, 240)}”.`); break; }
          case 'urlAssert': { const expected = detail.trim(); if (!page.url().includes(expected)) throw new Error(`Expected URL to include “${expected}”; received “${page.url()}”.`); break; }
          case 'screenshot': { const saveAs = detail.match(/save\s+as\s+(.+)$/i); const file = saveAs?.[1]?.trim() || (detail.trim() && !detail.toLowerCase().includes('save as') ? detail.trim() : `cobweb-step-${step.id}.png`); await page.screenshot({ path: file, fullPage: true, timeout }); return `Screenshot saved to ${file}`; }
          case 'extract': { const result = await locator().innerText({ timeout }); return `Extracted text: ${result.slice(0, 500)}`; }
          default: throw new Error(`Step type “${step.type}” is not supported by the Phase 4 runner yet.`);
        }
        return 'Step completed.';
      };
      const message = await cancellable(async () => { await waitIfPaused(step); return action(); });
      log(step, 'passed', message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (cancelled || /cancelled by user/i.test(message)) { log(step, 'cancelled', 'Workflow cancelled by user.'); break; }
      log(step, 'failed', message);
      break;
    }
  }
  const wasCancelled = cancelled;
  const failed = logs.some(item => item.status === 'failed');
  finalResult = { ok: !failed && !wasCancelled, cancelled: wasCancelled, logs, finalUrl: page.url() };
} catch (error) {
  finalResult = { ok: false, cancelled, logs, error: error instanceof Error ? error.message : String(error), finalUrl: page?.url?.() };
} finally {
  try { await browser?.close(); } catch { /* Closing the CDP client releases the runner connection. */ }
  send({ event: 'finished', result: finalResult ?? { ok: false, cancelled, logs, error: 'Runner exited without a result.' } });
  input.close();
}
