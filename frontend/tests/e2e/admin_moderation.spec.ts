import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const API = process.env.API_BASE || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function seedOwnerVenue(ownerId: string, name: string) {
  const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'Owner E2E Mod' }, JWT_SECRET, { expiresIn: '30m' });
  const res = await fetch(`${API}/api/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name,
      description: 'Moderation test venue',
      city: 'London', country: 'UK',
      capacity: 50, basePrice: 100,
      images: [], amenities: ['wifi'], eventTypes: ['wedding']
    })
  });
  if (!res.ok) throw new Error(`seed venue failed: ${res.status}`);
  return res.json();
}

function makeAdminToken(sub: string) {
  return jwt.sign({ sub, role: 'admin', name: 'E2E Admin' }, JWT_SECRET, { expiresIn: '30m' });
}

async function setAuth(page: any, token: string) {
  // Set cookie for server-side auth (Next.js server reads cookies())
  const baseURL: string = (page.context() as any)._options.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  // Use cookie with explicit domain for robustness
  const url = new URL(baseURL);
  await page.context().addCookies([
    { name: 'token', value: token, domain: url.hostname, path: '/', httpOnly: false, sameSite: 'Lax', secure: false },
  ]);
  // Set localStorage token for client-side api.ts (postJSON attaches Authorization from localStorage)
  await page.addInitScript((tkn: string) => {
    try {
      localStorage.setItem('token', tkn);
    } catch {}
  }, token);
}

test('admin can approve then suspend a venue and status reflects in UI', async ({ page }) => {
  const ownerId = 'owner_mod_' + Math.random().toString(36).slice(2, 7);
  const vName = 'Moderation ' + Math.random().toString(36).slice(2, 6);
  await seedOwnerVenue(ownerId, vName);

  const adminToken = makeAdminToken('admin_mod_' + Math.random().toString(36).slice(2, 6));
  await setAuth(page, adminToken);

  await page.goto('/admin/venues');
  await expect(page.getByRole('heading', { name: /Admin · Venues/i })).toBeVisible();

  // Wait for the row with our venue name to appear
  const row = page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: vName }).first();
  await expect(row).toBeVisible();

  // Initially should show pending
  await expect(row.getByTestId('cell-status')).toHaveText(/pending/i);

  // Approve and expect status to update optimistically and server-side
  await row.getByTestId('btn-approve').click();
  // Re-query the row in case of rerender
  const rowAfterApprove = page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: vName }).first();
  await expect(rowAfterApprove.getByTestId('cell-status')).toHaveText(/approved/i);

  // Suspend and expect status to update
  await rowAfterApprove.getByTestId('btn-suspend').click();
  const rowAfterSuspend = page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: vName }).first();
  await expect(rowAfterSuspend.getByTestId('cell-status')).toHaveText(/suspended/i);
});
