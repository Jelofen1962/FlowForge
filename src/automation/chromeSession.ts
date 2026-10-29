import { Builder, By, until, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import edge from 'selenium-webdriver/edge';
import firefox from 'selenium-webdriver/firefox';
import { detectInstalledBrowsers, type BrowserInfo } from './browsers';

export type RecordedAction =
  | { kind: 'click' | 'typeText' | 'selectOption'; selector: string; strategy: 'css' | 'xpath' | 'id'; value?: string; tagName: string }
  | { kind: 'openUrl'; url: string; tagName: string };
export type ScrapedItem = Record<string, string>;

export interface ElementSnapshot {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  selectors: { strategy: string; value: string; matches: number }[];
}

export class ChromeSession {
  private driver: WebDriver | null = null;
  private stopping: Promise<void> | null = null;

  async start(browserId = 'chrome'): Promise<void> {
    if (this.stopping) await this.stopping;
    if (this.driver) return;
    const browser = detectInstalledBrowsers().find((item) => item.id === browserId);
    if (!browser) throw new Error(`Browser '${browserId}' was not detected. Install it or choose another detected browser.`);
    const builder = new Builder();
    if (browser.id === 'firefox') {
      const options = new firefox.Options();
      options.setBinary(browser.path);
      if (process.env.CI || process.env.FLOWFORGE_HEADLESS === '1') options.addArguments('-headless');
      builder.forBrowser('firefox').setFirefoxOptions(options);
    } else if (browser.id === 'edge') {
      const options = new edge.Options();
      options.addArguments('--start-maximized', '--disable-notifications');
      if (process.env.CI || process.env.FLOWFORGE_HEADLESS === '1') options.addArguments('--headless=new', '--disable-gpu');
      builder.forBrowser('MicrosoftEdge').setEdgeOptions(options);
    } else {
      const options = new chrome.Options();
      options.setChromeBinaryPath(browser.path);
      options.addArguments('--start-maximized', '--disable-notifications');
      if (process.env.CI || process.env.FLOWFORGE_HEADLESS === '1') options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage');
      builder.forBrowser('chrome').setChromeOptions(options);
    }
    let driver: WebDriver;
    try { driver = await builder.build(); }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (/selenium-manager|Unable to obtain.*driver|driver location/i.test(detail)) {
        throw new Error(`Could not start ${browser.label}. FlowForge could not resolve its browser driver. Update or reinstall FlowForge so Selenium Manager is unpacked correctly, or install a compatible browser version. Details: ${detail}`);
      }
      throw error;
    }
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

  async extractImages(selector = 'img'): Promise<Record<string, string | number>[]> {
    if (selector.length > 2048) throw new Error('Selector exceeds the 2048 character limit');
    return this.requireDriver().executeScript<Record<string, string | number>[]>((query: string) =>
      [...document.querySelectorAll<HTMLImageElement>(query)].slice(0, 2000).map((image) => {
        const lazySource = image.getAttribute('data-src') || image.getAttribute('data-lazy-src') || image.getAttribute('data-original') || '';
        return {
        src: (!image.complete || image.naturalWidth === 0) && lazySource ? lazySource : image.currentSrc || image.getAttribute('src') || lazySource,
        srcset: image.getAttribute('srcset') || image.getAttribute('data-srcset') || '',
        alt: image.alt.slice(0, 1000), title: image.title.slice(0, 500),
        width: image.naturalWidth || image.width, height: image.naturalHeight || image.height,
        loading: image.loading, complete: image.complete ? 1 : 0,
        };
      }), selector);
  }

  async selectOption(selector: string, value: string, strategy = 'css', frameSelector = ''): Promise<{ selected: string }> {
    if (value.length > 100_000) throw new Error('Option value exceeds the 100,000 character limit');
    return this.inFrame(frameSelector, async () => {
      const driver = this.requireDriver();
      const element = await driver.findElement(this.locator(strategy, selector));
      const tag = await element.getTagName();
      if (tag.toLowerCase() !== 'select') throw new Error('Select option requires a <select> element');
      const options = await element.findElements(By.css('option'));
      for (const option of options) {
        if ((await option.getAttribute('value')) === value) { await option.click(); return { selected: value }; }
      }
      throw new Error(`No option with value ${value} exists in the select element`);
    });
  }

  async previewItems(itemSelector: string, fields: Record<string, string>): Promise<ScrapedItem[]> {
    return this.extractItems(itemSelector, fields, '', 1);
  }

  async extractItems(itemSelector: string, fields: Record<string, string>, nextSelector = '', maxPages = 1): Promise<ScrapedItem[]> {
    if (!itemSelector.trim() || itemSelector.length > 2048) throw new Error('A valid repeated-item selector is required');
    const fieldEntries = Object.entries(fields).filter(([name, selector]) => name.trim() && selector.trim());
    if (!fieldEntries.length) throw new Error('Configure at least one extraction field');
    if (fieldEntries.some(([, selector]) => selector.length > 2048)) throw new Error('Field selectors must be 2048 characters or fewer');
    if (nextSelector.length > 2048) throw new Error('Pagination selector exceeds the 2048 character limit');
    const pageLimit = Math.min(100, Math.max(1, Math.floor(maxPages) || 1));
    const driver = this.requireDriver();
    const rows: ScrapedItem[] = [];
    const seen = new Set<string>();
    for (let page = 0; page < pageLimit; page++) {
      const pageRows = await driver.executeScript<ScrapedItem[]>((containerSelector: string, configuredFields: [string, string][]) => {
        const containers = [...document.querySelectorAll(containerSelector)].slice(0, 500);
        return containers.map((container) => Object.fromEntries(configuredFields.map(([name, selector]) => {
          const element = container.matches(selector) ? container : container.querySelector(selector);
          if (!element) return [name, ''];
          const value = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
            ? element.value
            : element instanceof HTMLAnchorElement ? element.href
            : element instanceof HTMLImageElement ? element.currentSrc || element.src
            : (element instanceof HTMLElement ? element.innerText : element.textContent ?? '').trim();
          return [name, value.slice(0, 5000)];
        })));
      }, itemSelector, fieldEntries);
      let added = 0;
      for (const row of pageRows) {
        const fingerprint = JSON.stringify(row);
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint); rows.push(row); added++;
        if (rows.length >= 10_000) return rows;
      }
      if (page + 1 >= pageLimit || !nextSelector || !pageRows.length || added === 0) break;
      const next = await driver.findElements(this.locator('css', nextSelector));
      if (!next.length || !(await next[0].isDisplayed()) || !(await next[0].isEnabled())) break;
      const previousUrl = await driver.getCurrentUrl();
      const previousSource = await driver.getPageSource();
      await next[0].click();
      try {
        await driver.wait(async () => (await driver.getCurrentUrl()) !== previousUrl || (await driver.getPageSource()) !== previousSource, 10_000);
      } catch { break; }
    }
    return rows;
  }

  async click(selector: string, strategy = 'css', frameSelector = ''): Promise<{ clicked: true }> {
    return this.inFrame(frameSelector, async () => {
      const element = await this.requireDriver().findElement(this.locator(strategy, selector));
      await element.click();
      return { clicked: true as const };
    });
  }

  async typeText(selector: string, text: string, strategy = 'css', clear = true, frameSelector = ''): Promise<{ typed: number }> {
    if (text.length > 100_000) throw new Error('Input text exceeds the 100,000 character limit');
    return this.inFrame(frameSelector, async () => {
      const element = await this.requireDriver().findElement(this.locator(strategy, selector));
      if (clear) await element.clear();
      await element.sendKeys(text);
      return { typed: text.length };
    });
  }

  async waitForElement(selector: string, strategy = 'css', timeoutMs = 10_000, frameSelector = ''): Promise<{ found: true }> {
    return this.inFrame(frameSelector, async () => {
      const driver = this.requireDriver();
      await driver.wait(until.elementLocated(this.locator(strategy, selector)), Math.min(Math.max(timeoutMs, 100), 60_000));
      return { found: true as const };
    });
  }

  async readAttribute(selector: string, attribute = 'textContent', strategy = 'css', frameSelector = ''): Promise<string> {
    return this.inFrame(frameSelector, async () => {
      const element = await this.requireDriver().findElement(this.locator(strategy, selector));
      if (attribute === 'text' || attribute === 'textContent') return (await element.getText()).trim();
      return (await element.getAttribute(attribute)) ?? '';
    });
  }

  async testLocator(strategy: string, value: string, frameSelector = ''): Promise<{ matches: number; firstText?: string }> {
    return this.inFrame(frameSelector, async () => {
      const elements = await this.requireDriver().findElements(this.locator(strategy, value));
      return { matches: elements.length, ...(elements[0] ? { firstText: (await elements[0].getText()).slice(0, 500) } : {}) };
    });
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
        let timer = 0;
        const cssEscape = (value: string) => CSS.escape(value);
        const cssPath = (element: Element): string => {
          if (element.id) return `#${cssEscape(element.id)}`;
          const parts: string[] = [];
          let current: Element | null = element;
          while (current && current !== document.documentElement && parts.length < 6) {
            let part = current.tagName.toLowerCase();
            const stableClass = [...current.classList].find((name) => name.length < 40 && !/^(active|selected|hover|focus|ng-|css-)/i.test(name));
            if (stableClass) part += `.${cssEscape(stableClass)}`;
            const parentElement = current.parentElement as Element | null;
            if (parentElement) {
              const siblings = [...parentElement.children].filter((child) => child.tagName === current!.tagName);
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
            parts.unshift(part); current = parentElement;
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
          const cssMatches = (selector: string) => { try { return document.querySelectorAll(selector).length; } catch { return 0; } };
          const xpathMatches = (selector: string) => { try { return document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength; } catch { return 0; } };
          const selectors: ElementSnapshot['selectors'] = [];
          const addCss = (value: string) => selectors.push({ strategy: 'css', value, matches: cssMatches(value) });
          const addXpath = (value: string) => selectors.push({ strategy: 'xpath', value, matches: xpathMatches(value) });
          if (id) selectors.push({ strategy: 'id', value: id, matches: cssMatches(`#${cssEscape(id)}`) });
          for (const attribute of ['data-testid', 'data-test', 'data-qa', 'name']) {
            const value = element.getAttribute(attribute);
            if (value) addCss(`[${attribute}=${JSON.stringify(value)}]`);
          }
          const ariaLabel = element.getAttribute('aria-label');
          const title = element.getAttribute('title');
          const explicitRole = element.getAttribute('role');
          const implicitRole: Record<string, string> = {
            A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox',
            H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
            IMG: 'img', NAV: 'navigation', MAIN: 'main', FORM: 'form',
          };
          const role = explicitRole || implicitRole[element.tagName] || (element instanceof HTMLInputElement
            ? ({ checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button', search: 'searchbox' } as Record<string, string>)[element.type] || 'textbox'
            : '');
          const associatedLabel = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
            ? (element.labels?.[0]?.innerText ?? '') : '';
          const text = (element.textContent ?? '').trim().slice(0, 120);
          const accessibleName = (ariaLabel || associatedLabel || (element instanceof HTMLImageElement ? element.alt : '') || title || text).trim().slice(0, 120);
          if (ariaLabel) addXpath(`//${element.tagName.toLowerCase()}[@aria-label=${xpathLiteral(ariaLabel)}]`);
          if (title) addXpath(`//${element.tagName.toLowerCase()}[@title=${xpathLiteral(title)}]`);
          if (role && accessibleName) {
            const roleSelector = explicitRole
              ? `//*[@role=${xpathLiteral(role)} and (@aria-label=${xpathLiteral(accessibleName)} or normalize-space(.)=${xpathLiteral(accessibleName)})]`
              : `//${element.tagName.toLowerCase()}[(@aria-label=${xpathLiteral(accessibleName)} or normalize-space(.)=${xpathLiteral(accessibleName)})]`;
            addXpath(roleSelector);
          }
          if (associatedLabel && element instanceof HTMLInputElement) addXpath(`//label[normalize-space(.)=${xpathLiteral(associatedLabel)}]`);
          if (text && !['INPUT', 'TEXTAREA', 'SELECT', 'IMG'].includes(element.tagName)) {
            addXpath(`//${element.tagName.toLowerCase()}[normalize-space(.)=${xpathLiteral(text)}]`);
          }
          addCss(css);
          addXpath(xpath);
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

  async recordNextAction(timeoutMs = 60_000): Promise<RecordedAction> {
    const driver = this.requireDriver();
    let result: RecordedAction | { error: string };
    try {
      result = await driver.executeAsyncScript<RecordedAction | { error: string }>((timeout: number, done: (value: RecordedAction | { error: string }) => void) => {
        const w = window as Window & { __flowforgeRecorderCleanup?: () => void };
        w.__flowforgeRecorderCleanup?.();
        let timer = 0;
        const selectorFor = (element: Element): string => {
          if (element.id) return `#${CSS.escape(element.id)}`;
          const name = element.getAttribute('name');
          if (name) return `${element.tagName.toLowerCase()}[name=${JSON.stringify(name)}]`;
          const parts: string[] = [];
          let current: Element | null = element;
          while (current && current !== document.documentElement && parts.length < 6) {
            let part = current.tagName.toLowerCase();
            const parentElement = current.parentElement as Element | null;
            if (parentElement) {
              const siblings = [...parentElement.children].filter((child) => child.tagName === current!.tagName);
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
            parts.unshift(part);
            current = parentElement;
          }
          return parts.join(' > ');
        };
        const cleanup = () => {
          clearTimeout(timer);
          document.removeEventListener('click', onClick, true);
          document.removeEventListener('change', onChange, true);
          document.removeEventListener('keydown', onKey, true);
          delete w.__flowforgeRecorderCleanup;
        };
        const finish = (action: RecordedAction | { error: string }) => { cleanup(); done(action); };
        const onClick = (event: MouseEvent) => {
          const eventTarget = event.target;
          if (!(eventTarget instanceof Element)) return;
          const formControl = eventTarget.closest('input,textarea,select,option');
          if (formControl && !(formControl instanceof HTMLInputElement && ['checkbox', 'radio'].includes(formControl.type))) return;
          const target = formControl ?? eventTarget.closest('a[href],button,[role="button"],input[type="button"],input[type="submit"]') ?? eventTarget;
          const anchor = target.closest('a[href]');
          if (anchor instanceof HTMLAnchorElement && anchor.href && ['http:', 'https:'].includes(new URL(anchor.href).protocol)) {
            finish({ kind: 'openUrl', url: anchor.href, tagName: target.tagName.toLowerCase() });
            return;
          }
          finish({ kind: 'click', selector: selectorFor(target), strategy: 'css', tagName: target.tagName.toLowerCase() });
        };
        const onChange = (event: Event) => {
          const target = event.target;
          if (target instanceof HTMLSelectElement) {
            finish({ kind: 'selectOption', selector: selectorFor(target), strategy: 'css', value: target.value.slice(0, 100_000), tagName: target.tagName.toLowerCase() });
            return;
          }
          if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
          if (target instanceof HTMLInputElement && ['checkbox', 'radio', 'button', 'submit', 'file'].includes(target.type)) return;
          finish({ kind: 'typeText', selector: selectorFor(target), strategy: 'css', value: target.value.slice(0, 100_000), tagName: target.tagName.toLowerCase() });
        };
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') finish({ error: 'Recording cancelled' }); };
        w.__flowforgeRecorderCleanup = cleanup;
        document.addEventListener('click', onClick, true);
        document.addEventListener('change', onChange, true);
        document.addEventListener('keydown', onKey, true);
        timer = window.setTimeout(() => finish({ error: 'Recording timed out' }), timeout);
      }, timeoutMs);
    } finally {
      await driver.manage().setTimeouts({ script: 15_000 });
    }
    if ('error' in result) throw new Error(result.error);
    return result;
  }

  async stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    const driver = this.driver;
    this.driver = null;
    if (!driver) return;
    this.stopping = driver.quit().finally(() => { this.stopping = null; });
    await this.stopping;
  }

  isRunning(): boolean { return this.driver !== null; }

  listBrowsers(): BrowserInfo[] { return detectInstalledBrowsers(); }

  private async inFrame<T>(frameSelector: string, action: () => Promise<T>): Promise<T> {
    const driver = this.requireDriver();
    if (frameSelector.length > 2048) throw new Error('Frame selector exceeds the 2048 character limit');
    await driver.switchTo().defaultContent();
    try {
      if (frameSelector.trim()) {
        const frame = await driver.findElement(By.css(frameSelector));
        await driver.switchTo().frame(frame);
      }
      return await action();
    } finally {
      await driver.switchTo().defaultContent();
    }
  }

  private locator(strategy: string, value: string) {
    if (value.length > 2048) throw new Error('Selector exceeds the 2048 character limit');
    if (strategy === 'xpath') return By.xpath(value);
    if (strategy === 'id') return By.id(value);
    if (strategy !== 'css') throw new Error(`Unsupported locator strategy: ${strategy}`);
    return By.css(value);
  }

  private requireDriver(): WebDriver {
    if (!this.driver) throw new Error('The managed browser is not running. Start a browser session first.');
    return this.driver;
  }

}

export const chromeSession = new ChromeSession();
