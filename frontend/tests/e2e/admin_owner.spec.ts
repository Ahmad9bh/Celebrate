import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import type { Page } from '@playwright/test';

const API = process.env.API_BASE || 'http://localhost:4000';
const FRONTEND = process.env.FRONTEND_BASE || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function seedOwnerVenue(ownerId: string) {
  // Ensure an owner token (does not need to exist in DB; server creates if missing on POST /api/venues)
  const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'E2E Owner' }, JWT_SECRET, { expiresIn: '30m' });
  const res = await fetch(`${API}/api/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name: 'E2E Owner Venue',
      description: 'Owner venues page test',
      city: 'Dubai', country: 'UAE',
      capacity: 120, basePrice: 250, images: [], amenities: ['wifi'], eventTypes: ['wedding']
    })
  });
  if (!res.ok) throw new Error(`seed venue failed: ${res.status}`);
  return res.json();
}

function makeToken(sub: string, role: 'owner' | 'admin') {
  return jwt.sign({ sub, role, name: role === 'admin' ? 'E2E Admin' : 'E2E Owner' }, JWT_SECRET, { expiresIn: '30m' });
}

async function setCookie(page: Page, token: string) {
  await page.context().addCookies([{ name: 'token', value: token, url: FRONTEND }]);
}

test('owner venues page lists only my venues', async ({ page }) => {
  const ownerId = 'owner_e2e_' + Math.random().toString(36).slice(2, 7);
  const venue = await seedOwnerVenue(ownerId);
  const ownerToken = makeToken(ownerId, 'owner');

  await setCookie(page, ownerToken);
  await page.goto('/owner/venues');
  await expect(page.getByRole('heading', { name: /Owner · My Venues/i })).toBeVisible();

  // Should show at least the seeded venue
  const rows = page.getByTestId('owner-venue-row');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  await expect(rows.filter({ hasText: venue.name })).toHaveCount(1);
});

test('admin venues page lists all venues', async ({ page }) => {
  // Seed two venues under two different owners
  await seedOwnerVenue('owner_a_' + Math.random().toString(36).slice(2, 6));
  await seedOwnerVenue('owner_b_' + Math.random().toString(36).slice(2, 6));

  const adminToken = makeToken('admin_e2e_' + Math.random().toString(36).slice(2, 6), 'admin');
  await setCookie(page, adminToken);

  await page.goto('/admin/venues');
  await expect(page.getByRole('heading', { name: /Admin · Venues/i })).toBeVisible();

  const rows = page.getByTestId('admin-venue-row');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
});

test('owner can create a venue via UI and see it in My Venues', async ({ page }) => {
  const ownerId = 'owner_ui_' + Math.random().toString(36).slice(2, 7);
  const ownerToken = makeToken(ownerId, 'owner');

  // Set cookie for server-side guard and localStorage for client-side API helper
  await setCookie(page, ownerToken);
  await page.addInitScript((tkn) => {
    try { localStorage.setItem('token', tkn as string); } catch {}
  }, ownerToken);

  await page.goto('/owner/venues/new');
  await expect(page.getByRole('heading', { name: /Owner · New Venue/i })).toBeVisible();

  const name = 'UI Venue ' + Math.random().toString(36).slice(2, 6);
  await page.getByTestId('venue-name').fill(name);
  await page.getByTestId('venue-description').fill('Created from E2E');
  await page.getByTestId('venue-city').fill('Riyadh');
  await page.getByTestId('venue-country').fill('KSA');
  await page.getByTestId('venue-capacity').fill('80');
  await page.getByTestId('venue-basePrice').fill('300');
  await page.getByTestId('venue-submit').click();

  // Redirects back to /owner/venues and shows the new row
  await page.waitForURL('**/owner/venues');
  const rows = page.getByTestId('owner-venue-row');
  await expect(rows.filter({ hasText: name })).toHaveCount(1);
});

test('owner can edit a venue via UI and see the updated name', async ({ page }) => {
  const ownerId = 'owner_edit_' + Math.random().toString(36).slice(2, 7);
  const ownerToken = makeToken(ownerId, 'owner');
  // Seed a venue to edit
  const seeded = await seedOwnerVenue(ownerId);

  // Auth for both SSR and client-side API
  await setCookie(page, ownerToken);
  await page.addInitScript((tkn) => {
    try { localStorage.setItem('token', tkn as string); } catch {}
  }, ownerToken);

  // Navigate to edit page
  await page.goto(`/owner/venues/${seeded.id}/edit`);
  await expect(page.getByRole('heading', { name: /Owner · Edit Venue/i })).toBeVisible();

  const newName = 'Edited ' + Math.random().toString(36).slice(2, 6);
  const nameInput = page.getByTestId('edit-venue-name');
  await nameInput.click();
  await nameInput.fill('');
  await nameInput.type(newName);
  await page.getByTestId('edit-venue-submit').click();

  // Redirects back to list and shows updated name
  await page.waitForURL('**/owner/venues');
  const rows = page.getByTestId('owner-venue-row');
  await expect(rows.filter({ hasText: newName })).toHaveCount(1);
});
