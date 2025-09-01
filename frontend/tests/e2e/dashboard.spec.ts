import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const API = process.env.API_BASE || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function seedConfirmedBooking() {
  // Owner for venue creation
  const ownerLoginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-owner3@example.com' })
  });
  const ownerLogin = await ownerLoginRes.json();
  const ownerToken = jwt.sign({ sub: ownerLogin.user.id, role: 'owner', name: 'Owner 3' }, JWT_SECRET, { expiresIn: '30m' });

  const venueRes = await fetch(`${API}/api/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name: 'Dashboard Venue',
      description: 'For dashboard test',
      city: 'London', country: 'UK',
      capacity: 50, basePrice: 180, images: [], amenities: [], eventTypes: []
    })
  });
  if (!venueRes.ok) throw new Error(`venue seed failed: ${venueRes.status}`);
  const venue = await venueRes.json();

  // User for booking
  const userLoginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-user2@example.com' })
  });
  const userLogin = await userLoginRes.json();
  const userToken = userLogin.token as string;

  // Create booking
  const d = new Date(); d.setDate(d.getDate() + 2);
  const bookingRes = await fetch(`${API}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ venueId: venue.id, date: d.toISOString().slice(0,10), guests: 4 })
  });
  if (!bookingRes.ok) throw new Error(`booking create failed: ${bookingRes.status}`);
  const booking = await bookingRes.json();

  // Confirm booking without Stripe
  const confirmRes = await fetch(`${API}/api/payments/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ bookingId: booking.id })
  });
  if (!confirmRes.ok) throw new Error(`confirm failed: ${confirmRes.status}`);
  const confirmed = await confirmRes.json();

  return { userToken, booking: confirmed };
}

test('dashboard shows confirmed booking', async ({ page }) => {
  const { userToken, booking } = await seedConfirmedBooking();

  await page.addInitScript((tkn) => {
    try {
      localStorage.setItem('token', tkn as string);
    } catch {}
  }, userToken);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /My bookings/i })).toBeVisible();
  const cards = page.locator('.container .card');
  const thisBooking = cards.filter({ hasText: `Booking #${booking.id}` }).first();
  await expect(thisBooking).toBeVisible();
  await expect(thisBooking.getByText(/Status: confirmed/i)).toBeVisible();
});
