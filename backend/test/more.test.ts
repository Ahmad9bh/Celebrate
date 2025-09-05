import request from 'supertest';
import app from '../src/server';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import prisma from '../src/db';

describe('Celebrate API - more cases', () => {
  beforeEach(async () => {
    // Delete in dependency order to avoid FK violations in CI
    await prisma.booking.deleteMany({});
    await prisma.venue.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Admin venues requires auth -> 401 without token', async () => {
    const res = await request(app).get('/api/admin/venues');
    expect(res.status).toBe(401);
  });

  it('Booking cannot be in the past -> 400', async () => {
    // Prepare owner + venue
    const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'ownera@example.com' });
    const ownerId = ownerLogin.body.user.id as string;
    const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'OwnerA' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
    const venue = await request(app)
      .post('/api/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'V1', description: 'd', city: 'L', country: 'UK', capacity: 10, basePrice: 100, images: [], amenities: [], eventTypes: [] });

    const userLogin = await request(app).post('/api/auth/login').send({ email: 'usera@example.com' });
    const userToken = userLogin.body.token as string;

    const d = new Date(); d.setDate(d.getDate() - 1); // yesterday
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ venueId: venue.body.id, date: d.toISOString(), guests: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('Double booking same date prevented -> 400 on second', async () => {
    // Owner + venue
    const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'ownerb@example.com' });
    const ownerId = ownerLogin.body.user.id as string;
    const ownerToken = jwt.sign({ sub: ownerId, role: 'owner', name: 'OwnerB' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1h' });
    const venue = await request(app)
      .post('/api/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'V2', description: 'd', city: 'L', country: 'UK', capacity: 10, basePrice: 100, images: [], amenities: [], eventTypes: [] });

    // User
    const userLogin = await request(app).post('/api/auth/login').send({ email: 'userb@example.com' });
    const token = userLogin.body.token as string;
    const d = new Date(); d.setDate(d.getDate() + 1);

    const first = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.body.id, date: d.toISOString(), guests: 2 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.body.id, date: d.toISOString(), guests: 2 });
    expect(second.status).toBe(400);
    expect(second.body.error).toBeDefined();
  });

  it('Payments intent with invalid bookingId -> 404', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'payerx@example.com' });
    const token = login.body.token as string;
    const res = await request(app)
      .post('/api/payments/intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: 'nonexistent' });
    expect(res.status).toBe(404);
  });
});
