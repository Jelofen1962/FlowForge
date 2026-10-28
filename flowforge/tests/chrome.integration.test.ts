import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ChromeSession } from '../src/automation/chromeSession';

const enabled = process.env.FLOWFORGE_CHROME_INTEGRATION === '1';

describe.skipIf(!enabled)('managed Chrome integration', () => {
  const session = new ChromeSession();
  let server: Server;
  let url = '';

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html><head><title>FlowForge smoke</title></head><body>
        <main><h1 id="heading">Browser is alive</h1><a href="/next" title="Next page">Continue</a>
        <select id="choice"><option value="a">Alpha</option><option value="b">Beta</option></select>
        <img src="/pixel.png" alt="tiny pixel" width="1" height="1">
        </main></body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Local test server did not bind');
    url = `http://127.0.0.1:${address.port}/`;
    await session.start();
  }, 45_000);

  afterAll(async () => {
    await session.stop();
    await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  });

  it('navigates and extracts DOM data through the managed browser', async () => {
    const page = await session.navigate(url);
    expect(page.title).toBe('FlowForge smoke');
    expect(await session.snapshot('#heading')).toEqual([{ text: 'Browser is alive' }]);
    expect(await session.extractLinks()).toMatchObject([{ text: 'Continue', href: `${url}next`, title: 'Next page' }]);
    expect(await session.selectOption('#choice', 'b')).toEqual({ selected: 'b' });
    expect(await session.readAttribute('#choice', 'value')).toBe('b');
    expect(await session.extractImages()).toMatchObject([{ alt: 'tiny pixel' }]);
  }, 45_000);
});
