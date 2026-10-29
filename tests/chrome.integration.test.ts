import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ChromeSession } from '../src/automation/chromeSession';

const enabled = process.env.FLOWFORGE_CHROME_INTEGRATION === '1';

describe.skipIf(!enabled)('managed Chrome integration', () => {
  const session = new ChromeSession();
  let server: Server | undefined;
  let url = '';

  beforeAll(async () => {
    const testServer = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');
      if (requestUrl.pathname === '/pixel.png') {
        response.writeHead(204);
        response.end();
        return;
      }
      const secondPage = requestUrl.pathname === '/page/2';
      const items = secondPage
        ? '<article class="item"><h2 class="title">Gamma</h2><a href="/gamma">Open gamma</a></article>'
        : '<article class="item"><h2 class="title">Alpha</h2><a href="/alpha">Open alpha</a></article><article class="item"><h2 class="title">Beta</h2><a href="/beta">Open beta</a></article>';
      const nextLink = secondPage ? '' : '<a class="next" href="/page/2">Next page</a>';
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html><head><title>FlowForge smoke</title></head><body>
        <main><h1 id="heading" data-testid="page-heading">Browser is alive</h1>
        <a href="/next" title="Next page">Continue</a>
        <button id="record-button">Record click</button>
        <input id="record-input" name="record-input" value="">
        <select id="choice"><option value="a">Alpha</option><option value="b">Beta</option></select>
        <iframe id="inner-frame" title="Embedded form" srcdoc="<!doctype html><html><body><h2 id='frame-heading'>Inside frame</h2><button id='frame-button'>Frame action</button></body></html>"></iframe>
        <img src="/pixel.png" alt="tiny pixel" width="1" height="1">
        <section id="items">${items}</section>${nextLink}
        </main><script>
          const query = new URLSearchParams(location.search);
          if (query.get('pick') === '1') setTimeout(() => {
            const heading = document.querySelector('#heading');
            window.__pickerOverlaySeen = [...document.querySelectorAll('div')].some((el) => getComputedStyle(el).backgroundColor === 'rgba(255, 0, 0, 0.4)');
            heading.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
          }, 800);
          if (query.get('record') === 'click') setTimeout(() => document.querySelector('#record-button').dispatchEvent(new MouseEvent('click', { bubbles: true })), 800);
          if (query.get('record') === 'nav') setTimeout(() => document.querySelector('a[title="Next page"]').dispatchEvent(new MouseEvent('click', { bubbles: true })), 800);
          if (query.get('record') === 'type') setTimeout(() => {
            const input = document.querySelector('#record-input'); input.value = 'typed value'; input.dispatchEvent(new Event('change', { bubbles: true }));
          }, 800);
          if (query.get('record') === 'select') setTimeout(() => {
            const select = document.querySelector('#choice'); select.value = 'b'; select.dispatchEvent(new Event('change', { bubbles: true }));
          }, 800);
        </script></body></html>`);
    });
    server = testServer;
    await new Promise<void>((resolve, reject) => {
      testServer.once('error', reject);
      testServer.listen(0, '127.0.0.1', resolve);
    });
    const address = testServer.address();
    if (!address || typeof address === 'string') throw new Error('Local test server did not bind');
    url = `http://127.0.0.1:${address.port}/`;
    await session.start();
  }, 45_000);

  afterAll(async () => {
    try {
      await session.stop();
    } finally {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => error ? reject(error) : resolve());
        });
      }
    }
  });

  it('rejects unsafe navigation schemes without ending the browser session', async () => {
    await expect(session.navigate('file:///etc/passwd')).rejects.toThrow('Only HTTP and HTTPS URLs are supported');
    expect(session.isRunning()).toBe(true);
  }, 10_000);

  it('navigates and extracts DOM data through the managed browser', async () => {
    const page = await session.navigate(url);
    expect(page.title).toBe('FlowForge smoke');
    expect(await session.snapshot('#heading')).toEqual([{ text: 'Browser is alive' }]);
    expect(await session.extractLinks('a[title="Next page"]')).toEqual([{ text: 'Continue', href: `${url}next`, title: 'Next page' }]);
    expect(await session.selectOption('#choice', 'b')).toEqual({ selected: 'b' });
    expect(await session.readAttribute('#choice', 'value')).toBe('b');
    expect(await session.extractImages()).toMatchObject([{ alt: 'tiny pixel' }]);
  }, 45_000);

  it('picks an element with Alt+click and returns unique locator candidates', async () => {
    await session.navigate(`${url}?pick=1`);
    const selected = await session.selectElement(5_000);
    expect(selected.tagName).toBe('h1');
    expect(selected.text).toBe('Browser is alive');
    expect(selected.selectors.some((item) => item.strategy === 'id' && item.value === 'heading' && item.matches === 1)).toBe(true);
    expect(selected.selectors.some((item) => item.strategy === 'css' && item.value === '[data-testid="page-heading"]' && item.matches === 1)).toBe(true);
    expect(selected.selectors.some((item) => item.strategy === 'xpath' && item.value.includes("normalize-space(.)='Browser is alive'") && item.matches === 1)).toBe(true);
  }, 10_000);

  it('records HTTP(S) link navigation as an openUrl action', async () => {
    await session.navigate(`${url}?record=nav`);
    await expect(session.recordNextAction(5_000)).resolves.toMatchObject({ kind: 'openUrl', url: `${url}next`, tagName: 'a' });
  }, 10_000);

  it.each([
    ['click', { kind: 'click', selector: '#record-button', strategy: 'css', tagName: 'button' }],
    ['type', { kind: 'typeText', selector: '#record-input', strategy: 'css', value: 'typed value', tagName: 'input' }],
    ['select', { kind: 'selectOption', selector: '#choice', strategy: 'css', value: 'b', tagName: 'select' }],
  ] as const)('records a %s action', async (record, expected) => {
    await session.navigate(`${url}?record=${record}`);
    await expect(session.recordNextAction(5_000)).resolves.toMatchObject(expected);
  }, 10_000);


  it('runs locator actions inside a selected iframe and restores the top-level document', async () => {
    await session.navigate(url);
    expect(await session.readAttribute('#frame-heading', 'textContent', 'css', '#inner-frame')).toBe('Inside frame');
    await session.click('#frame-button', 'css', '#inner-frame');
    expect(await session.readAttribute('#heading')).toBe('Browser is alive');
    await expect(session.readAttribute('#missing', 'textContent', 'css', '#inner-frame')).rejects.toThrow();
    expect(await session.readAttribute('#heading')).toBe('Browser is alive');
  }, 15_000);

  it('previews only the current page without following pagination', async () => {
    await session.navigate(url);
    await expect(session.previewItems('article.item', { title: '.title' })).resolves.toEqual([
      { title: 'Alpha' },
      { title: 'Beta' },
    ]);
  }, 10_000);

  it('rejects missing extraction configuration before querying the page', async () => {
    await session.navigate(url);
    await expect(session.extractItems('', { title: '.title' })).rejects.toThrow('A valid repeated-item selector is required');
    await expect(session.extractItems('article.item', {})).rejects.toThrow('Configure at least one extraction field');
  }, 10_000);

  it('extracts repeated items across a next-page link', async () => {
    await session.navigate(url);
    const rows = await session.extractItems('article.item', { title: '.title', url: 'a' }, 'a.next', 2);
    expect(rows).toEqual([
      { title: 'Alpha', url: `${url}alpha` },
      { title: 'Beta', url: `${url}beta` },
      { title: 'Gamma', url: `${url}gamma` },
    ]);
  }, 20_000);

  it('stops idempotently and reports the session as closed', async () => {
    await session.stop();
    await session.stop();
    expect(session.isRunning()).toBe(false);
  }, 10_000);
});
