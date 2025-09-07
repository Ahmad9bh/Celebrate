import request from 'supertest';
import app from '../src/server';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import prisma from '../src/db';

// Basic smoke tests for key endpoints

describe('Celebrate API', () => {
  // Clean DB before each test to isolate state
  beforeEach(async () => {
    // Delete in dependency order to avoid FK violations in CI
    await prisma.processedEvent.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.venue.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('Webhook idempotency: duplicate event id is ignored', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    // Prepare a booking
    const login = await request(app).post('/api/auth/login').send({ email: 'payer3@example.com' });
    const token = login.body.token as string;
    const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'owner4@example.com' });
    const ownerId = ownerLogin.body.user.id as string;
    const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'Owner4' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
    const venue = await request(app)
      .post('/api/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'WV2', description: 'd', city: 'L', country: 'UK', capacity: 10, basePrice: 100, images: [], amenities: [], eventTypes: [] });
    const d = new Date(); d.setDate(d.getDate() + 1);
    const booking = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.body.id, date: d.toISOString(), guests: 2 });
    const bookingId = booking.body.id as string;

    // Fire the same webhook event twice
    const event = {
      id: 'evt_test_dupe_1',
      type: 'payment_intent.succeeded',
      data: { object: { metadata: { bookingId } } },
    };

    const first = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=test')
      .send(event);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true });

    const second = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=test')
      .send(event);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true, duplicate: true });

    // Booking should be confirmed and not changed beyond that
    const updated = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(updated?.status).toBe('confirmed');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
  it('GET /api/health -> 200 { ok: true }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('Payments: create intent for a booking', async () => {
    // Login user
    const login = await request(app).post('/api/auth/login').send({ email: 'payer@example.com' });
    expect(login.status).toBe(200);
    const token = login.body.token as string;

    // Create a venue (as owner)
    const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'owner2@example.com' });
    const ownerId = ownerLogin.body.user.id as string;
    const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'Owner2' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
    const venueRes = await request(app)
      .post('/api/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Pay Venue', description: 'desc', city: 'London', country: 'UK', capacity: 50, basePrice: 199, images: [], amenities: [], eventTypes: []
      });
    expect(venueRes.status).toBe(201);
    const venueId = venueRes.body.id as string;

    // Create a booking
    const d = new Date(); d.setDate(d.getDate() + 1);
    const booking = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId, date: d.toISOString(), guests: 2 });
    if (booking.status !== 201) {
      // CI diagnostics
      // eslint-disable-next-line no-console
      console.error('Booking creation failed', { status: booking.status, body: booking.body });
    }
    expect(booking.status).toBe(201);
    const bookingId = booking.body.id as string;

    // Request payment intent
    const intentRes = await request(app)
      .post('/api/payments/intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId });
    expect(intentRes.status).toBe(200);
    expect(typeof intentRes.body.clientSecret).toBe('string');
  });

  it('Webhook: updates booking status on payment_intent.succeeded', async () => {
    // Ensure webhook secret is set for handler
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    // Prepare a booking
    const login = await request(app).post('/api/auth/login').send({ email: 'payer2@example.com' });
    const token = login.body.token as string;
    const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'owner3@example.com' });
    const ownerId = ownerLogin.body.user.id as string;
    const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'Owner3' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
    const venue = await request(app)
      .post('/api/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'WV', description: 'd', city: 'L', country: 'UK', capacity: 10, basePrice: 100, images: [], amenities: [], eventTypes: [] });
    const d = new Date(); d.setDate(d.getDate() + 1);
    const booking = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.body.id, date: d.toISOString(), guests: 2 });
    if (booking.status !== 201) {
      // CI diagnostics
      // eslint-disable-next-line no-console
      console.error('Booking creation failed (webhook test)', { status: booking.status, body: booking.body });
    }
    const bookingId = booking.body.id as string;

    // Fire webhook event with mocked Stripe (server parses raw JSON in test)
    const event = {
      id: 'evt_test_1',
      type: 'payment_intent.succeeded',
      data: { object: { metadata: { bookingId } } },
    };

    const webhookRes = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=test')
      .send(event);
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body).toEqual({ received: true });

    // Verify booking status updated
    const updated = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(updated?.status).toBe('confirmed');
  });

  it('Bookings happy path: owner creates venue, user books it', async () => {
    // 1) Ensure an owner user row exists (login creates it if not)
    const ownerEmail = 'owner@example.com';
    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail });
    expect(ownerLogin.status).toBe(200);
    const ownerId = ownerLogin.body.user.id as string;

    // 2) Mint an OWNER JWT for this user id
    const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'Owner' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });

    // 3) Create a venue
    const venueRes = await request(app)
      .post('/api/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Venue',
        description: 'Nice place',
        city: 'London',
        country: 'UK',
        capacity: 100,
        basePrice: 250,
        images: [],
        amenities: ['wifi'],
        eventTypes: ['wedding']
      });
    expect(venueRes.status).toBe(201);
    const venueId = venueRes.body.id as string;

    // 4) Login as a normal user
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'booker@example.com' });
    expect(userLogin.status).toBe(200);
    const userToken = userLogin.body.token as string;

    // 5) Book tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ venueId, date: d.toISOString(), guests: 2 });
    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body.status).toBe('pending');
  });

  it('Admin guard: non-admin 403, admin 200', async () => {
    // Non-admin token
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'someuser@example.com' });
    const userToken = userLogin.body.token as string;
    const nonAdminRes = await request(app)
      .get('/api/admin/venues')
      .set('Authorization', `Bearer ${userToken}`);
    expect(nonAdminRes.status).toBe(403);

    // Admin token (no need for admin row; auth checks JWT role only)
    const adminToken = jwt.sign({ sub: 'admin-user', role: 'admin', name: 'Admin' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
    const adminRes = await request(app)
      .get('/api/admin/venues')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(Array.isArray(adminRes.body.items)).toBe(true);
  });

  it('GET /api/venues -> 200 items[]', async () => {
    const res = await request(app).get('/api/venues');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/venues pagination & sorting returns metadata and applies order', async () => {
    // Seed two venues in known order
    const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'owner.meta@example.com' });
    const ownerId = ownerLogin.body.user.id as string;
    const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'OwnerMeta' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
    const v1 = await request(app).post('/api/venues').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'A Venue', description: 'd', city: 'L', country: 'UK', capacity: 10, basePrice: 100, images: [], amenities: [], eventTypes: [] });
    const v2 = await request(app).post('/api/venues').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Z Venue', description: 'd', city: 'L', country: 'UK', capacity: 10, basePrice: 100, images: [], amenities: [], eventTypes: [] });
    expect(v1.status).toBe(201); expect(v2.status).toBe(201);

    const page1 = await request(app).get('/api/venues?page=1&pageSize=1&sort=name');
    expect(page1.status).toBe(200);
    expect(page1.body.page).toBe(1);
    expect(page1.body.pageSize).toBe(1);
    expect(typeof page1.body.total).toBe('number');
    expect(typeof page1.body.totalPages).toBe('number');
    expect(page1.body.items[0].name).toBe('A Venue');

    const page2desc = await request(app).get('/api/venues?page=1&pageSize=1&sort=-name');
    expect(page2desc.status).toBe(200);
    expect(page2desc.body.items[0].name).toBe('Z Venue');
  });

  it('GET /api/bookings/me without auth -> 401', async () => {
    const res = await request(app).get('/api/bookings/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login then GET /api/bookings/me -> 200', async () => {
    // Mock login with a dev email (will be created if not exists)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@example.com' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const token = login.body.token as string;
    const me = await request(app)
      .get('/api/bookings/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(Array.isArray(me.body.items)).toBe(true);
  });
});
