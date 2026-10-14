// FlowForge execution engine. Runs in a separate Node process.
const { Builder, By, Key, until } = require("selenium-webdriver");
const fs = require("node:fs");
const payload = JSON.parse(process.env.FLOWFORGE_PAYLOAD || "{}");
const steps = payload.steps || [];
const profile = payload.profile || {};
const emit = (type, data) => process.stdout.write(JSON.stringify({ type, data, at: new Date().toISOString() }) + "\n");
const locator = target => {
  if (!target || !target.value) throw new Error("Missing locator value");
  const strategies = { xpath: By.xpath, css: By.css, id: By.id, name: By.name, linkText: By.linkText, className: By.className, tagName: By.tagName };
  if (!strategies[target.strategy]) throw new Error(`Unsupported locator strategy: ${target.strategy}`);
  return strategies[target.strategy](target.value);
};
async function main() {
  const browser = profile.browser === "edge" ? "MicrosoftEdge" : "chrome";
  let builder = new Builder().forBrowser(browser);
  const options = {};
  if (payload.optimizations?.disableImages) options["prefs"] = { "profile.managed_default_content_settings.images": 2 };
  if (payload.optimizations?.disableCss) options["args"] = ["--disable-features=PaintHolding"];
  // Chrome and Edge use Chromium options. Selenium launches a real browser window.
  const { Options: ChromeOptions } = require("selenium-webdriver/chrome");
  const { Options: EdgeOptions } = require("selenium-webdriver/edge");
  builder = builder.setChromeOptions ? builder : builder;
  if (browser === "chrome") {
    const o = new ChromeOptions();
    if (payload.optimizations?.disableImages) o.setUserPreferences({ "profile.managed_default_content_settings.images": 2 });
    if (profile.userDataDir) o.addArguments(`--user-data-dir=${profile.userDataDir}`);
    builder.setChromeOptions(o);
  } else {
    const o = new EdgeOptions();
    if (profile.userDataDir) o.addArguments(`--user-data-dir=${profile.userDataDir}`);
    builder.setEdgeOptions(o);
  }
  let driver;
  try {
    driver = await builder.build();
    if (payload.startUrl) await driver.get(payload.startUrl);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.disabled) { emit("step", { index:i, status:"skipped", name:step.name }); continue; }
      emit("step", { index:i, status:"running", name:step.name });
      try {
        const el = step.target?.value ? await driver.findElement(locator(step.target)) : null;
        const timeout = Number(step.timeout || 10000);
        switch (step.type) {
          case "navigate": await driver.get(step.url); break;
          case "click": await driver.wait(until.elementIsVisible(el), timeout); await driver.wait(until.elementIsEnabled(el), timeout); await el.click(); break;
          case "type": await driver.wait(until.elementIsVisible(el), timeout); if (step.clearFirst) await el.clear(); await el.sendKeys(step.text || ""); break;
          case "key": await driver.actions().sendKeys(Key[step.key] || step.key || "").perform(); break;
          case "wait": await new Promise(r => setTimeout(r, Number(step.ms || 1000))); break;
          case "waitVisible": await driver.wait(until.elementLocated(locator(step.target)), timeout); await driver.wait(until.elementIsVisible(await driver.findElement(locator(step.target))), timeout); break;
          case "waitClickable": await driver.wait(until.elementIsEnabled(await driver.findElement(locator(step.target))), timeout); break;
          case "assertText": {
            const actual = await el.getText();
            if (!actual.includes(step.expected || "")) throw new Error(`Expected text "${step.expected}", got "${actual}"`);
            break;
          }
          case "select": await el.findElement(By.css(`option[value="${String(step.value).replace(/"/g, '\\"')}"]`)).click(); break;
          case "screenshot": {
            const data = await driver.takeScreenshot();
            const out = step.path || `flowforge-${Date.now()}.png`;
            fs.writeFileSync(out, data, "base64"); emit("screenshot", { path:out }); break;
          }
          case "back": await driver.navigate().back(); break;
          case "forward": await driver.navigate().forward(); break;
          case "refresh": await driver.navigate().refresh(); break;
          default: throw new Error(`Unknown step type: ${step.type}`);
        }
        emit("step", { index:i, status:"success", name:step.name });
      } catch (error) {
        emit("step", { index:i, status:"error", name:step.name, error:error.message });
        if (step.onError !== "continue") throw error;
      }
    }
    emit("done", { success:true });
  } catch (error) {
    emit("error", { message:error.message, stack:error.stack });
    process.exitCode = 1;
  } finally {
    if (driver && payload.closeBrowserWhenDone) await driver.quit().catch(()=>{});
  }
}
main();