import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as createNetServer } from 'node:net';

const browserExecutable = process.env.COBWEB_TEST_BROWSER;
const runnerPath = join(process.cwd(), 'scripts', 'run-workflow.mjs');
const integrationTest = browserExecutable ? test : test.skip;

async function freePort() {
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function fixture() {
  const web = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><title>CobWeb runner test</title></head><body><h1 id="heading">Runner ready</h1><input id="name"><button id="submit" onclick="document.querySelector(\'#result\').textContent=document.querySelector(\'#name\').value">Submit</button><p id="result"></p></body></html>');
  });
  web.listen(0, '127.0.0.1');
  await once(web, 'listening');
  const webPort = web.address().port;
  const cdpPort = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'cobweb-cdp-'));
  const browser = spawn(browserExecutable, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = async () => {
      if (browser.exitCode !== null) return reject(new Error(`Test browser exited with ${browser.exitCode}`));
      try {
        const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (response.ok) return resolve();
      } catch {}
      if (Date.now() - started > 10000) return reject(new Error('Timed out waiting for the test browser CDP endpoint.'));
      setTimeout(poll, 100);
    };
    void poll();
  });
  return { web, webPort, cdpPort, profile, browser };
}

async function runRunner(f, request) {
  const child = spawn(process.execPath, [runnerPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  const events = [];
  let buffer = '';
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.stdout.setEncoding('utf8').on('data', chunk => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) { try { events.push(JSON.parse(line)); } catch {} }
  });
  child.stdin.write(JSON.stringify({ runId: 'integration-run', startingUrl: `http://127.0.0.1:${f.webPort}`, port: f.cdpPort, timeout: 3000, liveDebugging: true, ...request }) + '\n');
  const waitFor = async predicate => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const found = events.find(predicate);
      if (found) return found;
      if (child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for runner event. Events: ${JSON.stringify(events)} Stderr: ${stderr}`);
  };
  return { child, events, waitFor, send: action => child.stdin.write(JSON.stringify({ runId: 'integration-run', ...action }) + '\n'), stderr };
}

async function closeFixture(f) {
  if (f?.browser && f.browser.exitCode === null) f.browser.kill();
  if (f?.web?.listening) await new Promise(resolve => f.web.close(resolve));
  if (f?.profile) await rm(f.profile, { recursive: true, force: true });
}

integrationTest('executes real navigation and form actions, then pauses at and resumes a breakpoint', async t => {
  const f = await fixture();
  t.after(() => closeFixture(f));
  const runner = await runRunner(f, { steps: [
    { id: 1, type: 'navigate', title: 'Navigate', detail: `http://127.0.0.1:${f.webPort}`, enabled: true, breakpoint: false },
    { id: 2, type: 'fill', title: 'Fill field', detail: 'css: #name · CobWeb', enabled: true, breakpoint: false },
    { id: 3, type: 'click', title: 'Submit', detail: 'css: #submit', enabled: true, breakpoint: true },
    { id: 4, type: 'textAssert', title: 'Assert submitted value', detail: 'css: #result · CobWeb', enabled: true, breakpoint: false },
  ] });
  const paused = await runner.waitFor(e => e.event === 'state' && e.state === 'paused' && e.step === 3);
  assert.equal(paused.reason, 'breakpoint');
  runner.send({ action: 'resume' });
  const finished = await runner.waitFor(e => e.event === 'finished');
  assert.equal(finished.result.ok, true, JSON.stringify(finished.result));
  assert.equal(finished.result.logs.filter(x => x.status === 'passed').length, 4);
  runner.child.stdin.end();
});

integrationTest('cancels a workflow while it is waiting', async t => {
  const f = await fixture();
  t.after(() => closeFixture(f));
  const runner = await runRunner(f, { steps: [
    { id: 1, type: 'delay', title: 'Long delay', detail: '30000 ms', enabled: true, breakpoint: false },
  ] });
  await runner.waitFor(e => e.event === 'step-start' && e.step.id === 1);
  runner.send({ action: 'stop' });
  const finished = await runner.waitFor(e => e.event === 'finished');
  assert.equal(finished.result.cancelled, true);
  assert.equal(finished.result.ok, false);
  runner.child.stdin.end();
});

integrationTest('records clicks and form values from the controlled browser page', async t => {
  const { chromium } = await import('@playwright/test');
  const f = await fixture();
  t.after(() => closeFixture(f));
  const runner = await runRunner(f, { mode: 'record', steps: [] });
  await runner.waitFor(e => e.event === 'state' && e.state === 'recording');
  const client = await chromium.connectOverCDP(`http://127.0.0.1:${f.cdpPort}`);
  const page = client.contexts()[0].pages()[0];
  await page.locator('#name').fill('CobWeb recorder');
  await page.locator('#submit').click();
  const fill = await runner.waitFor(e => e.event === 'recorded-step' && e.step.type === 'fill');
  const click = await runner.waitFor(e => e.event === 'recorded-step' && e.step.type === 'click');
  assert.match(fill.step.detail, /#name/);
  assert.match(fill.step.detail, /CobWeb recorder/);
  assert.match(click.step.detail, /#submit/);
  runner.send({ action: 'stop' });
  const finished = await runner.waitFor(e => e.event === 'finished');
  assert.equal(finished.result.mode, 'record');
  await client.close();
  runner.child.stdin.end();
});

integrationTest('picks an element and returns a usable CSS selector', async t => {
  const { chromium } = await import('@playwright/test');
  const f = await fixture();
  t.after(() => closeFixture(f));
  const runner = await runRunner(f, { mode: 'pick', steps: [] });
  await runner.waitFor(e => e.event === 'state' && e.state === 'picking');
  const client = await chromium.connectOverCDP(`http://127.0.0.1:${f.cdpPort}`);
  const page = client.contexts()[0].pages()[0];
  await page.locator('#heading').click();
  const picked = await runner.waitFor(e => e.event === 'picked-element' && e.selector);
  assert.equal(picked.selector, '#heading');
  const finished = await runner.waitFor(e => e.event === 'finished');
  assert.equal(finished.result.mode, 'pick');
  await client.close();
  runner.child.stdin.end();
});
