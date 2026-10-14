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
const mode = request.mode === 'record' || request.mode === 'pick' ? request.mode : 'run';
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

  if (mode === 'record' || mode === 'pick') {
    let sequence = 0;
    let lastUrl = page.url();
    let navigationFromRecordedClick = false;
    const sendRecordedStep = payload => {
      sequence += 1;
      send({ event: mode === 'pick' ? 'picked-element' : 'recorded-step', step: { ...payload, recordId: sequence } });
    };
    await page.exposeBinding('__cobwebRecordEvent', (_source, payload) => {
      if (cancelled || !payload || typeof payload !== 'object') return;
      if (mode === 'pick') {
        if (payload.kind === 'pick') {
          send({ event: 'picked-element', selector: payload.selector, tag: payload.tag, text: payload.text });
          cancelled = true;
          cancelResolver?.();
        }
        return;
      }
      if (payload.kind === 'click') {
        navigationFromRecordedClick = Boolean(payload.navigates);
        sendRecordedStep({ type: 'click', title: `Click ${payload.label || payload.tag || 'element'}`, detail: `css: ${payload.selector}`, enabled: true, breakpoint: false });
      } else if (payload.kind === 'fill') {
        sendRecordedStep({ type: 'fill', title: `Fill ${payload.label || payload.tag || 'field'}`, detail: `css: ${payload.selector} · “${String(payload.value ?? '').slice(0, 500)}”`, enabled: true, breakpoint: false });
      }
    });
    const recorderScript = (pickMode) => {
      if (window.__cobwebRecorderInstalled) return;
      window.__cobwebRecorderInstalled = true;
      let hover;
      const listeners = [];
      const listen = (type, handler) => { document.addEventListener(type, handler, true); listeners.push([type, handler]); };
      let lastFieldKey = '';
      let lastFieldAt = 0;
      const esc = value => window.CSS && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
      const cssPath = element => {
        if (!(element instanceof Element)) return '';
        for (const attr of ['data-testid', 'data-test', 'data-qa']) {
          const value = element.getAttribute(attr);
          if (value) { const candidate = `[${attr}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`; try { if (document.querySelectorAll(candidate).length === 1) return candidate; } catch {} }
        }
        if (element.id) { const candidate = `#${esc(element.id)}`; try { if (document.querySelectorAll(candidate).length === 1) return candidate; } catch {} }
        const name = element.getAttribute('name');
        if (name) { const candidate = `${element.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`; try { if (document.querySelectorAll(candidate).length === 1) return candidate; } catch {} }
        const aria = element.getAttribute('aria-label');
        if (aria) { const candidate = `${element.tagName.toLowerCase()}[aria-label="${aria.replace(/"/g, '\\"')}"]`; try { if (document.querySelectorAll(candidate).length === 1) return candidate; } catch {} }
        const parts = [];
        let node = element;
        while (node && node.nodeType === 1 && parts.length < 7) {
          let part = node.tagName.toLowerCase();
          if (node.id) { const candidate = `#${esc(node.id)}`; try { if (document.querySelectorAll(candidate).length === 1) { parts.unshift(candidate); break; } } catch {} part += `#${esc(node.id)}`; }
          const parent = node.parentElement;
          if (parent) {
            const sameTag = Array.from(parent.children).filter(child => child.tagName === node.tagName);
            if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
          }
          parts.unshift(part);
          node = parent;
        }
        return parts.join(' > ');
      };
      const labelFor = element => (element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || element.innerText || element.value || element.tagName.toLowerCase()).trim().slice(0, 80);
      const highlight = element => {
        if (hover) hover.remove();
        hover = document.createElement('div');
        const rect = element.getBoundingClientRect();
        Object.assign(hover.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, zIndex: '2147483647', pointerEvents: 'none', border: '2px solid #ef4444', background: 'rgba(239,68,68,.18)', boxSizing: 'border-box' });
        hover.dataset.cobwebOverlay = 'true';
        document.documentElement.appendChild(hover);
      };
      listen('mouseover', event => { const el = event.target; if (el instanceof Element && !el.closest('[data-cobweb-overlay]')) highlight(el); });
      listen('mouseout', event => { if (event.target instanceof Element && hover) { hover.remove(); hover = null; } });
      listen('click', event => {
        const raw = event.target;
        if (!(raw instanceof Element) || raw.closest('[data-cobweb-overlay]')) return;
        const el = raw.closest('button,a,input,textarea,select,[role="button"],[role="link"]') || raw;
        const selector = cssPath(el);
        if (pickMode) {
          event.preventDefault(); event.stopImmediatePropagation();
          window.__cobwebRecordEvent({ kind: 'pick', selector, tag: el.tagName.toLowerCase(), text: labelFor(el) });
          return;
        }
        if (!el.matches('input,textarea,select,[contenteditable="true"]')) window.__cobwebRecordEvent({ kind: 'click', selector, tag: el.tagName.toLowerCase(), label: labelFor(el), navigates: el.matches('a[href],area[href]') });
      });
      const recordField = event => {
        if (pickMode) return;
        const el = event.target;
        if (!(el instanceof Element) || !el.matches('input:not([type="password"]),textarea,select,[contenteditable="true"]')) return;
        const selector = cssPath(el);
        const value = el.matches('[contenteditable="true"]') ? el.textContent : el.value;
        const key = `${selector}\u0000${String(value ?? '')}`;
        const now = Date.now();
        if (key === lastFieldKey && now - lastFieldAt < 300) return;
        lastFieldKey = key; lastFieldAt = now;
        window.__cobwebRecordEvent({ kind: 'fill', selector, tag: el.tagName.toLowerCase(), label: labelFor(el), value });
      };
      listen('change', recordField);
      listen('focusout', event => { if (event.target instanceof Element && event.target.matches('input:not([type="password"]),textarea,[contenteditable="true"]')) recordField(event); });
      window.__cobwebRecorderCleanup = () => { for (const [type, handler] of listeners) document.removeEventListener(type, handler, true); if (hover) hover.remove(); delete window.__cobwebRecorderCleanup; delete window.__cobwebRecorderInstalled; };
    };
    await page.addInitScript(recorderScript, mode === 'pick');
    await page.evaluate(recorderScript, mode === 'pick');
    const navHandler = frame => {
      if (frame !== page.mainFrame()) return;
      const current = frame.url();
      if (mode === 'record' && current && current !== lastUrl && /^https?:/i.test(current)) {
        lastUrl = current;
        if (navigationFromRecordedClick) { navigationFromRecordedClick = false; return; }
        sendRecordedStep({ type: 'navigate', title: 'Navigate to URL', detail: current, enabled: true, breakpoint: false });
      }
    };
    page.on('framenavigated', navHandler);
    send({ event: 'state', state: mode === 'pick' ? 'picking' : 'recording' });
    if (mode === 'pick') {
      await Promise.race([cancellation, page.waitForEvent('close').catch(() => {})]);
    } else {
      await cancellation;
    }
    page.off('framenavigated', navHandler);
    try { await page.evaluate(() => window.__cobwebRecorderCleanup?.()); } catch { /* The page may have navigated or closed during recording. */ }
    try { await page.removeExposedFunction('__cobwebRecordEvent'); } catch { /* Cleanup is best-effort on closed pages. */ }
    finalResult = { ok: true, stopped: true, mode, logs, finalUrl: page.url() };
  } else {
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
  }
} catch (error) {
  finalResult = { ok: false, cancelled, logs, error: error instanceof Error ? error.message : String(error), finalUrl: page?.url?.() };
} finally {
  try { await browser?.close(); } catch { /* Closing the CDP client releases the runner connection. */ }
  send({ event: 'finished', result: finalResult ?? { ok: false, cancelled, logs, error: 'Runner exited without a result.' } });
  input.close();
}
