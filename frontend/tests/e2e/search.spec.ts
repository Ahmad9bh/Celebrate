import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const API = process.env.API_BASE || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function seedVenue() {
  // Ensure owner user exists (login will create if missing)
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-owner@example.com' }),
  });
  const login = await loginRes.json();
  const ownerId = login.user.id as string;
  const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'Owner E2E' }, JWT_SECRET, { expiresIn: '30m' });

  // Create a London venue
  const venueRes = await fetch(`${API}/api/venues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      name: 'E2E Venue',
      description: 'Nice test venue',
      city: 'London',
      country: 'UK',
      capacity: 80,
      basePrice: 200,
      images: [],
      amenities: ['wifi'],
      eventTypes: ['wedding'],
    }),
  });
  if (!venueRes.ok) {
    const t = await venueRes.text();
    throw new Error(`Failed to seed venue: ${venueRes.status} ${t}`);
  }
}

test('home -> search London shows results', async ({ page }) => {
  // Seed backend
  await seedVenue();

  // Navigate to home and perform search
  await page.goto('/');
  await page.fill('input[name="city"]', 'London');
  await page.click('button[type="submit"]');

  // Verify search results UI
  await expect(page.getByRole('heading', { name: 'Search results' })).toBeVisible();
  const results = page.locator('.container .card');
  await expect(results.first()).toBeVisible();
  const firstMatch = results.filter({ hasText: 'E2E Venue' }).first();
  await expect(firstMatch).toBeVisible();
});
