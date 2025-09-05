import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const API = process.env.API_BASE || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function makeToken(sub: string, role: 'owner' | 'admin', name: string) {
  return jwt.sign({ sub, role, name }, JWT_SECRET, { expiresIn: '30m' });
}

async function setAuth(page: any, token: string) {
  const baseURL: string = (page.context() as any)._options.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const url = new URL(baseURL);
  await page.context().addCookies([
    { name: 'token', value: token, domain: url.hostname, path: '/', httpOnly: false, sameSite: 'Lax', secure: false },
  ]);
  await page.addInitScript((tkn: string) => {
    try { localStorage.setItem('token', tkn); } catch {}
  }, token);
}

async function seedVenueAsOwner(ownerId: string, name: string) {
  const ownerToken = makeToken(ownerId, 'owner', 'Owner SoftDelete');
  const res = await fetch(`${API}/api/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name,
      description: 'Soft delete test venue',
      city: 'London', country: 'UK',
      capacity: 40, basePrice: 120,
      images: [], amenities: ['wifi'], eventTypes: ['wedding']
    })
  });
  if (!res.ok) throw new Error(`seed venue failed: ${res.status}`);
  return res.json();
}

test('owner can soft-delete a venue and it disappears from owner and admin lists', async ({ page }) => {
  const ownerId = 'owner_sd_' + Math.random().toString(36).slice(2, 7);
  const adminId = 'admin_sd_' + Math.random().toString(36).slice(2, 7);
  const vName = 'SoftDel ' + Math.random().toString(36).slice(2, 6);

  const created = await seedVenueAsOwner(ownerId, vName);
  const venueId: string = created.id;

  // Authenticate as owner and verify the venue appears in My Venues
  await setAuth(page, makeToken(ownerId, 'owner', 'Owner SoftDelete'));
  await page.goto('/owner/venues');
  await expect(page.getByRole('heading', { name: /Owner · My Venues/i })).toBeVisible();
  const ownerRow = page.getByTestId('owner-venue-row').filter({ hasText: vName }).first();
  await expect(ownerRow).toBeVisible();

  // Trigger delete and accept confirmation dialog
  page.once('dialog', d => d.accept());
  await Promise.all([
    page
      .waitForResponse(
        res => res.url().endsWith(`/api/venues/${venueId}`) && res.request().method() === 'DELETE' && res.ok(),
        { timeout: 10_000 }
      )
      .catch(() => null),
    page.getByTestId(`btn-delete-${venueId}`).click(),
  ]);
  // If response was missed, rely on UI idle and DOM state
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

  // Expect the row to be gone from owner list
  await expect(page.getByTestId('owner-venue-row').filter({ hasText: vName })).toHaveCount(0);

  // Switch to admin and verify it does not appear in admin list (isDeleted filtered)
  await setAuth(page, makeToken(adminId, 'admin', 'Admin SoftDelete'));
  await page.goto('/admin/venues');
  await expect(page.getByRole('heading', { name: /Admin · Venues/i })).toBeVisible();
  await expect(page.getByTestId('admin-venues-table').getByTestId('admin-venue-row').filter({ hasText: vName })).toHaveCount(0, { timeout: 15000 });
});
