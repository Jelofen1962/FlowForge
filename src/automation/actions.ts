import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ActionRegistry } from '../workflow/engine';
import { chromeSession } from './chromeSession';

export function registerAutomationActions(registry: ActionRegistry, outputDirectory: string): void {
  registry.register('click', async (config) => {
    const selector = config.selector;
    if (typeof selector !== 'string' || !selector) throw new Error('Click element requires a selector');
    return chromeSession.click(selector, typeof config.strategy === 'string' ? config.strategy : 'css');
  });
  registry.register('typeText', async (config) => {
    if (typeof config.selector !== 'string' || !config.selector) throw new Error('Type text requires a selector');
    const text = typeof config.text === 'string' ? config.text : '';
    return chromeSession.typeText(config.selector, text, typeof config.strategy === 'string' ? config.strategy : 'css', config.clear !== false);
  });
  registry.register('waitForElement', async (config) => {
    if (typeof config.selector !== 'string' || !config.selector) throw new Error('Wait for element requires a selector');
    return chromeSession.waitForElement(config.selector, typeof config.strategy === 'string' ? config.strategy : 'css', Number(config.timeoutMs ?? 10_000));
  });
  registry.register('readAttribute', async (config, context) => {
    if (typeof config.selector !== 'string' || !config.selector) throw new Error('Read attribute requires a selector');
    const value = await chromeSession.readAttribute(config.selector, typeof config.attribute === 'string' ? config.attribute : 'textContent', typeof config.strategy === 'string' ? config.strategy : 'css');
    if (typeof config.outputVariable === 'string' && config.outputVariable) context.variables[config.outputVariable] = value;
    return value;
  });
  registry.register('openUrl', async (config) => {
    const url = config.url;
    if (typeof url !== 'string' || !url.trim()) throw new Error('Open URL requires a URL');
    if (!chromeSession.isRunning()) await chromeSession.start();
    return chromeSession.navigate(url);
  });
  registry.register('extractText', async (config, context) => {
    const selector = typeof config.selector === 'string' && config.selector.trim() ? config.selector : 'body';
    const elements = await chromeSession.snapshot(selector);
    const text = elements.map((element) => element.text).join('\n');
    if (typeof config.outputVariable === 'string' && config.outputVariable) context.variables[config.outputVariable] = text;
    return text;
  });
  registry.register('extractLinks', async (config, context) => {
    const selector = typeof config.selector === 'string' && config.selector.trim() ? config.selector : 'a[href]';
    const links = await chromeSession.extractLinks(selector);
    if (typeof config.outputVariable === 'string' && config.outputVariable) context.variables[config.outputVariable] = links;
    return links;
  });
  registry.register('writeFile', async (config) => {
    const filename = typeof config.filename === 'string' ? config.filename : 'output.json';
    if (filename !== path.basename(filename) || /[\\/]/.test(filename) || filename === '.' || filename === '..') throw new Error('Output filename must not contain a path');
    const content = config.content;
    const serialized = typeof content === 'string' ? content : JSON.stringify(content ?? null, null, 2) ?? 'null';
    if (Buffer.byteLength(serialized, 'utf8') > 50 * 1024 * 1024) throw new Error('Output exceeds the 50 MB limit');
    await fs.mkdir(outputDirectory, { recursive: true });
    const destination = path.join(outputDirectory, filename);
    const temporary = `${destination}.tmp`;
    await fs.writeFile(temporary, serialized, 'utf8');
    await fs.rename(temporary, destination);
    return { path: destination, bytes: Buffer.byteLength(serialized, 'utf8') };
  });
}
