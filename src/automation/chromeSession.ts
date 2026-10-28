import { Builder, By, until, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

export interface ElementSnapshot {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  selectors: { strategy: string; value: string; matches: number }[];
}

export class ChromeSession {
  private driver: WebDriver | null = null;

  async start(): Promise<void> {
    if (this.driver) return;
    const options = new chrome.Options();
    options.addArguments('--start-maximized', '--disable-notifications');
    const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    this.driver = driver;
    try { await driver.manage().setTimeouts({ implicit: 0, pageLoad: 45_000, script: 15_000 }); }
    catch (error) { this.driver = null; await driver.quit(); throw error; }
  }

  async navigate(url: string): Promise<{ url: string; title: string }> {
    const driver = this.requireDriver();
    if (url.length > 4096) throw new Error('URL exceeds the 4096 character limit');
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
    await driver.get(parsed.toString());
    return { url: await driver.getCurrentUrl(), title: await driver.getTitle() };
  }

  async snapshot(selector: string): Promise<{ text: string }[]> {
    if (selector.length > 2048) throw new Error('Selector exceeds the 2048 character limit');
    return this.requireDriver().executeScript<{ text: string }[]>((query: string) =>
      [...document.querySelectorAll(query)].slice(0, 500).map((element) => ({ text: (element instanceof HTMLElement ? element.innerText : element.textContent ?? '').trim().slice(0, 5_000) })), selector);
  }

  async extractLinks(selector = 'a[href]'): Promise<{ text: string; href: string; title: string }[]> {
    if (selector.length > 2048) throw new Error('Selector exceeds the 2048 character limit');
    return this.requireDriver().executeScript<{ text: string; href: string; title: string }[]>((query: string) =>
      [...document.querySelectorAll<HTMLAnchorElement>(query)].slice(0, 2000)
        .filter((element) => Boolean(element.href))
        .map((element) => ({ text: element.innerText.trim().slice(0, 500), href: element.href.slice(0, 2048), title: element.title.slice(0, 200) })), selector);
  }

  async click(selector: string, strategy = 'css'): Promise<{ clicked: true }> {
    const driver = this.requireDriver();
    const element = await driver.findElement(this.locator(strategy, selector));
    await element.click();
    return { clicked: true };
  }

  async typeText(selector: string, text: string, strategy = 'css', clear = true): Promise<{ typed: number }> {
    if (text.length > 100_000) throw new Error('Input text exceeds the 100,000 character limit');
    const driver = this.requireDriver();
    const element = await driver.findElement(this.locator(strategy, selector));
    if (clear) await element.clear();
    await element.sendKeys(text);
    return { typed: text.length };
  }

  async waitForElement(selector: string, strategy = 'css', timeoutMs = 10_000): Promise<{ found: true }> {
    const driver = this.requireDriver();
    await driver.wait(until.elementLocated(this.locator(strategy, selector)), Math.min(Math.max(timeoutMs, 100), 60_000));
    return { found: true };
  }

  async readAttribute(selector: string, attribute = 'textContent', strategy = 'css'): Promise<string> {
    const element = await this.requireDriver().findElement(this.locator(strategy, selector));
    if (attribute === 'text' || attribute === 'textContent') return (await element.getText()).trim();
    const value = await element.getAttribute(attribute);
    return value ?? '';
  }

  async testLocator(strategy: string, value: string): Promise<{ matches: number; firstText?: string }> {
    const driver = this.requireDriver();
    const elements = await driver.findElements(this.locator(strategy, value));
    return { matches: elements.length, ...(elements[0] ? { firstText: (await elements[0].getText()).slice(0, 500) } : {}) };
  }

  async selectElement(timeoutMs = 60_000): Promise<ElementSnapshot> {
    const driver = this.requireDriver();
    await driver.manage().setTimeouts({ script: timeoutMs + 1_000 });
    let selected: ElementSnapshot | { error: string };
    try { selected = await driver.executeAsyncScript<ElementSnapshot | { error: string }>((timeout: number, done: (result: ElementSnapshot | { error: string }) => void) => {
        const w = window as Window & { __flowforgeRecorderCleanup?: () => void };
        w.__flowforgeRecorderCleanup?.();
        const overlay = document.createElement('div');
        Object.assign(overlay.style, { position: 'fixed', zIndex: '2147483647', pointerEvents: 'none', background: 'rgba(255, 0, 0, 0.4)', border: '2px solid rgba(255, 0, 0, 0.95)', boxSizing: 'border-box', display: 'none' });
        document.documentElement.appendChild(overlay);
        let timer: number;
        const cssEscape = (value: string) => CSS.escape(value);
        const cssPath = (element: Element): string => {
          if (element.id) return `#${cssEscape(element.id)}`;
          const parts: string[] = [];
          let current: Element | null = element;
          while (current && current !== document.documentElement && parts.length < 6) {
            let part = current.tagName.toLowerCase();
            const stableClass = [...current.classList].find((name) => name.length < 40 && !/^(active|selected|hover|focus|ng-|css-)/i.test(name));
            if (stableClass) part += `.${cssEscape(stableClass)}`;
            const parent: Element | null = current.parentElement;
            if (parent) {
              const siblings = [...parent.children].filter((child) => child.tagName === current!.tagName);
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
            parts.unshift(part); current = parent;
          }
          return parts.join(' > ');
        };
        const xpathLiteral = (value: string): string => {
          if (!value.includes("'")) return `'${value}'`;
          if (!value.includes('"')) return `"${value}"`;
          return `concat(${value.split("'").map((part) => `'${part}'`).join(', "\'", ')})`;
        };
        const xpathPath = (element: Element): string => {
          if (element.id) return `//*[@id=${xpathLiteral(element.id)}]`;
          const parts: string[] = [];
          let current: Element | null = element;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) if (sibling.tagName === current.tagName) index++;
            parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
            current = current.parentElement;
          }
          return `/${parts.join('/')}`;
        };
        const describe = (element: Element): ElementSnapshot => {
          const css = cssPath(element);
          const xpath = xpathPath(element);
          const id = element.id;
          const name = element.getAttribute('name') ?? '';
          const cssMatches = (selector: string) => { try { return document.querySelectorAll(selector).length; } catch { return 0; } };
          const xpathMatches = (selector: string) => { try { return document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength; } catch { return 0; } };
          const selectors = [
            ...(id ? [{ strategy: 'id', value: id, matches: cssMatches(`#${cssEscape(id)}`) }] : []),
            ...(name ? [{ strategy: 'css', value: `[name="${name.replace(/"/g, '\\"')}"]`, matches: cssMatches(`[name="${name.replace(/"/g, '\\"')}"]`) }] : []),
            { strategy: 'css', value: css, matches: cssMatches(css) },
            { strategy: 'xpath', value: xpath, matches: xpathMatches(xpath) },
          ];
          const attributes: Record<string, string> = {};
          for (const attr of [...element.attributes].slice(0, 30)) attributes[attr.name] = attr.value.slice(0, 500);
          return { tagName: element.tagName.toLowerCase(), text: (element.textContent ?? '').trim().slice(0, 1000), attributes, selectors };
        };
        const move = (event: MouseEvent) => {
          const target = event.target;
          if (!(target instanceof Element) || target === overlay) return;
          const rect = target.getBoundingClientRect();
          Object.assign(overlay.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        };
        const cancel = (event: KeyboardEvent) => {
          if (event.key !== 'Escape') return;
          cleanup(); done({ error: 'Element selection cancelled' });
        };
        const select = (event: MouseEvent) => {
          if (!event.altKey || !(event.target instanceof Element)) return;
          event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
          cleanup();
          done(describe(event.target));
        };
        const cleanup = () => { clearTimeout(timer); document.removeEventListener('mousemove', move, true); document.removeEventListener('click', select, true); document.removeEventListener('keydown', cancel, true); overlay.remove(); delete w.__flowforgeRecorderCleanup; };
        w.__flowforgeRecorderCleanup = cleanup;
        document.addEventListener('mousemove', move, true);
        document.addEventListener('click', select, true);
        document.addEventListener('keydown', cancel, true);
        timer = window.setTimeout(() => { cleanup(); done({ error: 'Element selection timed out' }); }, timeout);
      }, timeoutMs);
    } finally {
      if (this.driver) await this.driver.manage().setTimeouts({ script: 15_000 });
    }
    if ('error' in selected) throw new Error(selected.error);
    return selected;
  }

  async stop(): Promise<void> {
    const driver = this.driver;
    this.driver = null;
    if (driver) await driver.quit();
  }

  isRunning(): boolean { return this.driver !== null; }

  private locator(strategy: string, value: string) {
    if (value.length > 2048) throw new Error('Selector exceeds the 2048 character limit');
    if (strategy === 'xpath') return By.xpath(value);
    if (strategy === 'id') return By.id(value);
    if (strategy !== 'css') throw new Error(`Unsupported locator strategy: ${strategy}`);
    return By.css(value);
  }

  private requireDriver(): WebDriver {
    if (!this.driver) throw new Error('Chrome is not running. Start a browser session first.');
    return this.driver;
  }

}

export const chromeSession = new ChromeSession();
