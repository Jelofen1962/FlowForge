import { chromium } from '@playwright/test';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const port = Number(request.port || 9222);
const timeout = Math.min(120000, Math.max(100, Number(request.timeout || 10000)));
const logs = [];
const log = (step, status, message) => logs.push({ step: step?.id ?? null, title: step?.title ?? 'Browser', status, message, at: new Date().toISOString() });
const selectorFrom = (detail = '') => {
  const raw = String(detail).trim().replace(/^css:\s*/i, '');
  const split = raw.split(/\s+[·|]\s+|\s+·\s+|\s+\u00b7\s+/)[0].trim();
  if (!split || /^(select an element|css selector)$/i.test(split)) throw new Error('Configure a CSS selector in the step settings.');
  return split;
};
const valueFrom = (detail = '') => {
  const quoted = String(detail).match(/[“"]([^”"]*)[”"]/);
  if (quoted) return quoted[1];
  const pieces = String(detail).split(/\s+[·|]\s+/);
  return pieces.length > 1 ? pieces.slice(1).join(' · ').trim() : '';
};
let browser;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout });
  const contexts = browser.contexts();
  const context = contexts[0] ?? await browser.newContext();
  let page = context.pages()[0] ?? await context.newPage();
  if (request.startingUrl && page.url() === 'about:blank') await page.goto(request.startingUrl, { waitUntil: 'domcontentloaded', timeout });
  for (const step of request.steps ?? []) {
    if (!step.enabled) { log(step, 'skipped', 'Step is disabled.'); continue; }
    try {
      const detail = String(step.detail ?? '');
      const selector = () => selectorFrom(detail);
      const locator = () => page.locator(selector()).first();
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
        case 'screenshot': { const saveAs = detail.match(/save\s+as\s+(.+)$/i); const file = saveAs?.[1]?.trim() || (detail.trim() && !detail.toLowerCase().includes('save as') ? detail.trim() : `cobweb-step-${step.id}.png`); await page.screenshot({ path: file, fullPage: true, timeout }); log(step, 'passed', `Screenshot saved to ${file}`); continue; }
        case 'extract': { const result = await locator().innerText({ timeout }); log(step, 'passed', `Extracted text: ${result.slice(0, 500)}`); continue; }
        default: throw new Error(`Step type “${step.type}” is not supported by the Phase 4 runner yet.`);
      }
      log(step, 'passed', 'Step completed.');
    } catch (error) {
      log(step, 'failed', error instanceof Error ? error.message : String(error));
      break;
    }
  }
  const failed = logs.some(item => item.status === 'failed');
  process.stdout.write(JSON.stringify({ ok: !failed, logs, finalUrl: page.url() }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, logs, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* the CDP browser belongs to Cobweb; close only the client connection */ }
}
