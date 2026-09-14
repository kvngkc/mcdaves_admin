import { test, expect } from '@playwright/test';

test('admin login page renders and protects dashboard', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/McDaves Admin Console/i);
  await expect(page.getByRole('heading', { name: 'McDaves Admin Console' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Access Dashboard' })).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.getByRole('heading', { name: 'McDaves Admin Console' })).toBeVisible();
});
