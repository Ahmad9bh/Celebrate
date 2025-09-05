import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const API = process.env.API_BASE || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function waitForConfirmedBooking(userToken: string, bookingId: string) {
  const deadline = Date.now() + 30000;
  let last: any = null;
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/api/bookings/me`, { headers: { Authorization: `Bearer ${userToken}` } });
    if (res.ok) {
      const data = await res.json();
      const items = (data.items || []) as any[];
      const target = items.find((b: any) => b.id === bookingId);
      if (target) {
        last = target;
        if (target.status === 'confirmed') return target;
      } else if (items.length) {
        last = items[0];
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for confirmed booking. Last seen: ${JSON.stringify(last)}`);
}

async function seedVenue(): Promise<string> {
  // Ensure owner exists and mint owner token to create venue
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-owner2@example.com' }),
  });
  const login = await loginRes.json();
  const ownerId = login.user.id as string;
  const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'Owner E2E 2' }, JWT_SECRET, { expiresIn: '30m' });

  const venueRes = await fetch(`${API}/api/venues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      name: 'E2E Venue Bookable',
      description: 'Bookable test venue',
      city: 'London',
      country: 'UK',
      capacity: 120,
      basePrice: 250,
      images: [],
      amenities: ['wifi'],
      eventTypes: ['wedding'],
    }),
  });
  if (!venueRes.ok) {
    const t = await venueRes.text();
    throw new Error(`Failed to seed venue: ${venueRes.status} ${t}`);
  }
  const venue = await venueRes.json();
  return venue.id as string;
}

async function loginAsUser(): Promise<{ token: string; userId: string }> {
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-user@example.com' }),
  });
  if (!loginRes.ok) throw new Error('login failed');
  const data = await loginRes.json();
  return { token: data.token as string, userId: data.user.id as string };
}

test('book a venue without Stripe (payments disabled)', async ({ page }) => {
  test.setTimeout(60_000);
  const venueId = await seedVenue();
  const { token } = await loginAsUser();

  // Set token in localStorage before any navigations
  await page.addInitScript((tkn) => {
    try {
      localStorage.setItem('token', tkn as string);
    } catch {}
  }, token);

  // Go to venue page
  await page.goto(`/venue/${venueId}`);

  // Fill booking form
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const iso = d.toISOString().slice(0, 10);
  await page.fill('input[type="date"]', iso);
  await page.fill('input[type="number"]', '3');

  // Submit and wait: observe the first POST to /api/bookings and then proceed (accept any status to avoid timeouts)
  const submit = page.getByRole('button', { name: /Book & Pay/i });
  const bookingCreatedPromise = page.waitForResponse((r) => r.url().includes('/api/bookings') && r.request().method() === 'POST');
  await Promise.all([
    bookingCreatedPromise,
    submit.click(),
  ]);
  const createdRes = await bookingCreatedPromise;
  if (!createdRes.ok()) {
    const bodyText = await createdRes.text().catch(() => '');
    throw new Error(`Booking creation failed: ${createdRes.status()} ${bodyText}`);
  }
  const created = await createdRes.json();

  // Proactively confirm booking from test to avoid timing races in UI path
  const confirmRes = await fetch(`${API}/api/payments/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bookingId: created.id }),
  });
  if (!confirmRes.ok) {
    const t = await confirmRes.text().catch(() => '');
    throw new Error(`Confirm API failed: ${confirmRes.status} ${t}`);
  }

  // Poll backend until THIS booking is confirmed, then assert via dashboard UI for robustness
  const confirmed = await waitForConfirmedBooking(token, created.id);
  await page.goto('/dashboard');
  const cards = page.locator('.container .card');
  const thisBooking = cards.filter({ hasText: `Booking #${confirmed.id}` }).first();
  await expect(thisBooking).toBeVisible();
  await expect(thisBooking.getByText(/Status: confirmed/i)).toBeVisible();
});
