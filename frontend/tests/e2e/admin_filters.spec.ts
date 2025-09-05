async function waitAdminListReload(page: any, timeout: number = 15000) {
  await page.waitForResponse(
    (res: any) => {
      try {
        const url = res.url();
        const method = res.request().method();
        const status = res.status?.() ?? 0;
        return url.includes('/api/admin/venues') && (method === 'GET' || method === 'POST') && status < 400;
      } catch {
        return false;
      }
    },
    { timeout }
  );
}
import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const API = process.env.API_BASE || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function makeToken(sub: string, role: 'owner' | 'admin', name?: string) {
  return jwt.sign({ sub, role, name: name || (role === 'admin' ? 'E2E Admin' : 'E2E Owner') }, JWT_SECRET, { expiresIn: '30m' });
}

test('Approve then Suspend toggles update counts dynamically', async ({ page }) => {
  const name = 'AF-Toggle-' + Math.random().toString(36).slice(2, 6);
  await seedVenue('owner_af_' + Math.random().toString(36).slice(2, 6), name);

  await setAuth(page, makeToken('admin_af_' + Math.random().toString(36).slice(2, 6), 'admin'));
  await page.goto('/admin/venues');
  await expect(page.getByRole('heading', { name: /Admin · Venues/i })).toBeVisible();

  const row = page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible();

  // Initially pending: counts should reflect
  await page.getByTestId('filter-pending').click();
  let shown = await page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').count();
  let count = await getButtonCount(page, 'filter-pending');
  expect(shown).toBe(count);

  // Approve -> should move from Pending to Approved
  await page.getByTestId('filter-all').click();
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/admin/venues/') && res.request().method() === 'POST' && res.ok()),
    row.getByTestId('btn-approve').click(),
  ]);
  await page.getByTestId('filter-approved').click();
  await waitAdminListReload(page, 15000);
  await page.waitForLoadState('networkidle', { timeout: 5000 });
  shown = await page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').count();
  count = await getButtonCount(page, 'filter-approved');
  expect(shown).toBe(count);
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(1, { timeout: 15000 });
  await page.getByTestId('filter-pending').click();
  await waitAdminListReload(page, 15000);
  await page.waitForLoadState('networkidle', { timeout: 5000 });
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(0, { timeout: 15000 });

  // Suspend -> should move from Approved to Suspended
  await page.getByTestId('filter-all').click();
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/admin/venues/') && res.request().method() === 'POST' && res.ok()),
    row.getByTestId('btn-suspend').click(),
  ]);
  await page.getByTestId('filter-suspended').click();
  await waitAdminListReload(page, 15000);
  await page.waitForLoadState('networkidle', { timeout: 5000 });
  shown = await page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').count();
  count = await getButtonCount(page, 'filter-suspended');
  expect(shown).toBe(count);
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(1);
  await page.getByTestId('filter-approved').click();
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(0);
});

test('Admin delete removes venue and updates counts', async ({ page }) => {
  const name1 = 'AF-Del-1-' + Math.random().toString(36).slice(2, 6);
  const name2 = 'AF-Del-2-' + Math.random().toString(36).slice(2, 6);
  await seedVenue('owner_af_' + Math.random().toString(36).slice(2, 6), name1);
  await seedVenue('owner_af_' + Math.random().toString(36).slice(2, 6), name2);

  await setAuth(page, makeToken('admin_af_' + Math.random().toString(36).slice(2, 6), 'admin'));
  await page.goto('/admin/venues');
  await expect(page.getByRole('heading', { name: /Admin · Venues/i })).toBeVisible();

  await page.getByTestId('filter-all').click();
  let countAllBefore = await getButtonCount(page, 'filter-all');
  // Delete name1
  const row1 = page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name1 }).first();
  await expect(row1).toBeVisible();
  page.once('dialog', d => d.accept());
  await row1.getByTestId('btn-delete').click();

  // Counts update
  const countAllAfter = await getButtonCount(page, 'filter-all');
  expect(countAllAfter).toBe(countAllBefore - 1);
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name1 })).toHaveCount(0);
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name2 })).toHaveCount(1);
});


async function getButtonCount(page: any, testId: string) {
  const text = await page.getByTestId(testId).innerText();
  const m = text.match(/\((\d+)\)/);
  return m ? parseInt(m[1], 10) : 0;
}
test('Admin can suspend a venue and it appears only under Suspended', async ({ page }) => {
  const name = 'AF-Suspended-' + Math.random().toString(36).slice(2, 6);
  const v = await seedVenue('owner_af_' + Math.random().toString(36).slice(2, 6), name);

  // Login as admin
  await setAuth(page, makeToken('admin_af_' + Math.random().toString(36).slice(2, 6), 'admin'));

  await page.goto('/admin/venues');
  await expect(page.getByRole('heading', { name: /Admin · Venues/i })).toBeVisible();

  // Approve then suspend the venue
  const row = page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name }).first();
  await expect(row).toBeVisible();
  await row.getByTestId('btn-approve').click();
  await row.getByTestId('btn-suspend').click();

  // Suspended filter should show it
  await page.getByTestId('filter-suspended').click();
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(1);
  await expect(page.getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(1);
  {
    const shown = await page.getByTestId('admin-venue-row').count();
    const count = await getButtonCount(page, 'filter-suspended');
    expect(shown).toBe(count);
  }

  // Pending and Approved should not show it
  await page.getByTestId('filter-pending').click();
  await expect(page.getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(0);
  {
    const shown = await page.getByTestId('admin-venue-row').count();
    const count = await getButtonCount(page, 'filter-pending');
    expect(shown).toBe(count);
  }
  await page.getByTestId('filter-approved').click();
  await expect(page.getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(0);
  {
    const shown = await page.getByTestId('admin-venue-row').count();
    const count = await getButtonCount(page, 'filter-approved');
    expect(shown).toBe(count);
  }

  // All should include it
  await page.getByTestId('filter-all').click();
  await expect(page.getByTestId('admin-venue-row').filter({ hasText: name })).toHaveCount(1);
  {
    const shown = await page.getByTestId('admin-venue-row').count();
    const count = await getButtonCount(page, 'filter-all');
    expect(shown).toBe(count);
  }
});

async function seedVenue(ownerId: string, name: string) {
  const t = makeToken(ownerId, 'owner');
  const res = await fetch(`${API}/api/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      name,
      description: 'Admin filter test',
      city: 'London', country: 'UK',
      capacity: 50, basePrice: 200, images: [], amenities: ['wifi'], eventTypes: ['wedding']
    })
  });
  if (!res.ok) throw new Error('seed failed');
  return res.json();
}

async function setAuth(page: any, token: string) {
  const baseURL: string = (page.context() as any)._options.baseURL || process.env.FRONTEND_BASE || 'http://localhost:3000';
  const url = new URL(baseURL);
  await page.context().addCookies([{ name: 'token', value: token, domain: url.hostname, path: '/' }]);
  await page.addInitScript((tkn: string) => { try { localStorage.setItem('token', tkn); } catch {} }, token);
}

test('Admin filters between Pending and Approved', async ({ page }) => {
  // Seed two venues owned by different users
  const pendingName = 'AF-Pending-' + Math.random().toString(36).slice(2, 6);
  const approvedName = 'AF-Approved-' + Math.random().toString(36).slice(2, 6);
  const v1 = await seedVenue('owner_af_' + Math.random().toString(36).slice(2, 6), pendingName);
  const v2 = await seedVenue('owner_af_' + Math.random().toString(36).slice(2, 6), approvedName);

  // Login as admin
  await setAuth(page, makeToken('admin_af_' + Math.random().toString(36).slice(2, 6), 'admin'));

  // Go to admin venues and approve one of them
  await page.goto('/admin/venues');
  await expect(page.getByRole('heading', { name: /Admin · Venues/i })).toBeVisible();

  // Approve approvedName row
  const targetRow = page.getByTestId('admin-venue-row').filter({ hasText: approvedName }).first();
  await expect(targetRow).toBeVisible();
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/admin/venues/') && res.request().method() === 'POST' && res.ok()),
    targetRow.getByTestId('btn-approve').click(),
  ]);

  // Check Pending filter only shows pendingName, not approvedName
  await page.getByTestId('filter-pending').click();
  await waitAdminListReload(page);
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: pendingName })).toHaveCount(1, { timeout: 15000 });
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: approvedName })).toHaveCount(0, { timeout: 15000 });
  {
    const shown = await page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').count();
    const count = await getButtonCount(page, 'filter-pending');
    expect(shown).toBe(count);
  }

  // Check Approved filter only shows approvedName
  await page.getByTestId('filter-approved').click();
  await waitAdminListReload(page);
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: approvedName })).toHaveCount(1, { timeout: 15000 });
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: pendingName })).toHaveCount(0, { timeout: 15000 });
  {
    const shown = await page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').count();
    const count = await getButtonCount(page, 'filter-approved');
    expect(shown).toBe(count);
  }

  // All shows both
  await page.getByTestId('filter-all').click();
  await waitAdminListReload(page);
  await page.waitForLoadState('networkidle', { timeout: 5000 });
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: pendingName })).toHaveCount(1, { timeout: 15000 });
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: approvedName })).toHaveCount(1, { timeout: 15000 });
  {
    const shown = await page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').count();
    const count = await getButtonCount(page, 'filter-all');
    expect(shown).toBe(count);
  }
});
