import { test, expect, type Page } from "@playwright/test";

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", error => errors.push(error.message));
});

test("UI-001 main workspace renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Automation studio")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product price monitor" })).toBeVisible();
  await expect(page.getByText("Workflow start")).toBeVisible();
  await expect(page.getByText("Workflow complete")).toBeVisible();
});

test("UI-002 starter steps and inspector render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Open product page")).toBeVisible();
  await expect(page.getByText("Wait for page")).toBeVisible();
  await expect(page.getByText("Extract product details")).toBeVisible();
  await expect(page.getByLabel("Target URL")).toHaveValue("https://example.com/products");
});

test("UI-003 workflow name can be changed", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workflow name").fill("QA crawl");
  await expect(page.getByRole("heading", { name: "QA crawl" })).toBeVisible();
});

test("UI-004 add and configure a step", async ({ page }) => {
  await page.goto("/");
  await page.locator(".palette-item").filter({ hasText: "Type text" }).click();
  await page.getByLabel("Step name").fill("Enter search term");
  await expect(page.getByText("Enter search term")).toBeVisible();
  await expect(page.getByLabel("Step name")).toHaveValue("Enter search term");
});

test("UI-005 step type can be changed", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Action type").selectOption("wait");
  await expect(page.getByLabel("Action type")).toHaveValue("wait");
  await expect(page.getByLabel("Delay (milliseconds)")).toBeVisible();
});

test("UI-006 selected step can be disabled and enabled", async ({ page }) => {
  const { backend } = await import("../src/backend");
  void backend;
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Enable step" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
});

test("UI-007 step library search filters results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Search steps" }).fill("extract");
  await expect(page.locator(".palette-item").filter({ hasText: "Extract data" })).toBeVisible();
  await expect(page.locator(".palette-item").filter({ hasText: "Navigate" })).toHaveCount(0);
});

test("UI-008 selected step can be moved up", async ({ page }) => {
  await page.goto("/");
  await page.locator(".flow-node").filter({ hasText: "Wait for page" }).click();
  await page.getByRole("button", { name: "Move up", exact: true }).click();
  const names = await page.locator(".flow-node .node-content > strong").allTextContents();
  expect(names.indexOf("Wait for page")).toBeLessThan(names.indexOf("Open product page"));
});

test("UI-009 selected step can be deleted", async ({ page }) => {
  await page.goto("/");
  await page.locator(".flow-node").filter({ hasText: "Open product page" }).click();
  await page.getByRole("button", { name: "Delete step", exact: true }).click();
  await expect(page.locator(".flow-node").filter({ hasText: "Open product page" })).toHaveCount(0);
  await expect(page.getByText("Wait for page")).toBeVisible();
});

test("UI-010 workflow can be reset", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workflow name").fill("Temporary name");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("heading", { name: "Product price monitor" })).toBeVisible();
});

test("UI-011 JSON export copies workflow", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: /Export JSON/ }).click();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Product price monitor");
});

test("UI-012 browser discovery gives feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Discover browsers" }).click();
  await expect(page.locator(".statusbar")).toContainText("Browser discovery complete");
});

test("UI-013 workflow run failure is surfaced in browser preview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Run workflow/ }).click();
  await expect(page.locator(".statusbar")).toContainText("Workflow execution requires the CobWeb desktop backend.");
  await expect(page.getByText("Needs attention")).toBeVisible();
});

test("UI-014 inspector can be hidden and reopened", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle inspector" }).click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle inspector" }).click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
});

test("UI-015 step library can be hidden and reopened", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hide step library" }).click();
  await expect(page.getByText("STEP LIBRARY")).toHaveCount(0);
  await page.getByRole("button", { name: "Show step library" }).click();
  await expect(page.getByText("STEP LIBRARY")).toBeVisible();
});

test("UI-016 data tab shows empty-state guidance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Data/ }).click();
  await expect(page.getByText("No output data yet")).toBeVisible();
  await expect(page.getByText(/Run a workflow with an Extract data step/)).toBeVisible();
});

test("UI-017 layout remains usable at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Run workflow/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
});

test("UI-018 no uncaught page errors on initial load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product price monitor" })).toBeVisible();
  expect(errors).toEqual([]);
});
