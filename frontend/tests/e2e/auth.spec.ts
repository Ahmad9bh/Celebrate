import { test, expect } from '@playwright/test';

test('auth UI login redirects to home and stores token', async ({ page }) => {
  await page.goto('/auth');
  await page.fill('input[type="email"]', 'alice@example.com');
  const loginRespPromise = page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /sign in/i }).click();
  const loginResp = await loginRespPromise;
  const ok = loginResp.ok();
  if (!ok) {
    const txt = await loginResp.text().catch(() => '');
    throw new Error(`login failed: ${loginResp.status()} ${txt}`);
  }
  await page.waitForURL('**/');
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
});
