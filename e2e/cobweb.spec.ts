import { test, expect } from '@playwright/test';

test('workspace loads and navigates to Settings', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('BROWSER AUTOMATION')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('website can be added and persists after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Websites/ }).first().click();
  await page.getByRole('button', { name: /Add website/ }).click();
  await page.locator('#site-name').fill('Phase Three Test');
  await page.locator('#site-url').fill('https://example.com');
  await page.getByRole('button', { name: /Add website/ }).last().click();
  await expect(page.getByText('Phase Three Test')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Websites/ }).first().click();
  await expect(page.getByText('Phase Three Test')).toBeVisible();
});

test('workflow editor exposes export and step creation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Run automation/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add step' }).first().click();
  await expect(page.getByPlaceholder('Find an interaction…')).toBeVisible();
  await page.getByRole('button', { name: /Wait \/ delay/ }).click();
  await expect(page.getByText('Wait / delay')).toBeVisible();
});
