import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import prisma from './db';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

// Stripe client (mocked in test)
const stripe: any = (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_STRIPE)
  ? {
      paymentIntents: {
        create: async (_args: any) => ({ id: 'pi_test_123', client_secret: 'cs_test_123' }),
      },
      webhooks: {
        constructEvent: (body: Buffer | string, _sig: string, _secret: string) => {
          const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
          return JSON.parse(text);
        },
      },
    }
  : new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2024-06-20' as any });

const app = express();
app.use(helmet());
// NOTE: JSON parser is added AFTER the Stripe webhook so that the webhook can use raw body
app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)), credentials: true }));

// Standardized error helpers
function err(res: any, status: number, code: string, message: string, details?: any) {
  const body: any = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}
const badRequest = (res: any, code: string, message: string, details?: any) => err(res, 400, code, message, details);
const unauthorized = (res: any, message = 'Unauthorized') => err(res, 401, 'unauthorized', message);
const forbidden = (res: any, message = 'Forbidden') => err(res, 403, 'forbidden', message);
const notFound = (res: any, message = 'Not found') => err(res, 404, 'not_found', message);
const internalError = (res: any, message = 'Internal server error') => err(res, 500, 'internal_error', message);

// Minimal structured logger
function logInfo(msg: string, ctx?: Record<string, any>) {
  if (ctx) console.log(JSON.stringify({ level: 'info', msg, ...ctx }));
  else console.log(JSON.stringify({ level: 'info', msg }));
}
function logWarn(msg: string, ctx?: Record<string, any>) {
  if (ctx) console.warn(JSON.stringify({ level: 'warn', msg, ...ctx }));
  else console.warn(JSON.stringify({ level: 'warn', msg }));
}
function logError(msg: string, ctx?: Record<string, any>) {
  if (ctx) console.error(JSON.stringify({ level: 'error', msg, ...ctx }));
  else console.error(JSON.stringify({ level: 'error', msg }));
}

// Rate limiters
const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const paymentsLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const webhookLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

// Helpers to adapt stringified JSON fields from SQLite-backed Prisma
function safeParseArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  try { return JSON.parse(String(val)); } catch { return []; }
}
function hydrateVenue(v: any) {
  return {
    ...v,
    amenities: safeParseArray((v as any).amenities),
    eventTypes: safeParseArray((v as any).eventTypes),
    images: safeParseArray((v as any).images),
  };
}

// Simple auth middleware (mock)
function auth(requiredRoles?: Array<'user'|'owner'|'admin'>) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return requiredRoles ? res.status(401).json({ error: 'Unauthorized' }) : next();
    const token = authHeader.replace('Bearer ', '');
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      req.user = payload;
      if (requiredRoles && !requiredRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// Schemas
const VenueCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  city: z.string().min(1),
  country: z.string().min(1),
  capacity: z.number().int().nonnegative(),
  basePrice: z.number().nonnegative(),
  rating: z.number().min(0).max(5).optional(),
  images: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  eventTypes: z.array(z.string()).optional(),
});

const BookingCreateSchema = z.object({
  venueId: z.string().min(1),
  date: z.union([z.string(), z.date()]).transform((d: string | Date) => new Date(d as any)),
  guests: z.number().int().min(1),
});

const PaymentIntentSchema = z.object({
  bookingId: z.string().min(1),
});

// Stripe webhook must receive the raw body for signature verification
app.post('/api/payments/webhook', webhookLimiter, express.raw({ type: 'application/json' }), async (req: any, res) => {
  try {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!sig) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err: any) {
      logWarn('webhook signature verification failed', { error: err?.message });
      return badRequest(res, 'webhook_invalid_signature', `Webhook Error: ${err?.message || 'invalid signature'}`);
    }

    // Idempotency: ignore already processed event IDs
    const eid = (event as any)?.id as string | undefined;
    if (!eid) {
      return badRequest(res, 'webhook_missing_event_id', 'Missing event id');
    }
    const seen = await prisma.processedEvent.findUnique({ where: { eventId: eid } }).catch(() => null);
    if (seen) {
      logInfo('webhook event already processed; ignoring', { eventId: eid, type: event.type });
      return res.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        const bookingId = (pi?.metadata?.bookingId
          || pi?.metadata?.booking_id
          || pi?.bookingId) as string | undefined;
        logInfo('webhook payment_intent.succeeded', { eventId: eid, bookingId });
        if (bookingId) {
          await prisma.booking.update({ where: { id: bookingId }, data: { status: 'confirmed' } }).catch(() => {});
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        const bookingId = (pi?.metadata?.bookingId
          || pi?.metadata?.booking_id
          || pi?.bookingId) as string | undefined;
        logInfo('webhook payment_intent.payment_failed', { eventId: eid, bookingId });
        if (bookingId) {
          await prisma.booking.update({ where: { id: bookingId }, data: { status: 'failed' } }).catch(() => {});
        }
        break;
      }
      default:
        // no-op for other events
        break;
    }
    // Mark processed after successful handling
    await prisma.processedEvent.create({ data: { eventId: eid } }).catch(() => {});
    res.json({ received: true });
  } catch (e) {
    logError('webhook handler error', { error: (e as any)?.message });
    internalError(res, 'Webhook handler error');
  }
});

// Now enable JSON parser for the rest of the routes
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/health', (_req, res) => res.json({ ok: true }));

// OpenAPI spec + Swagger UI (no extra deps; uses CDN)
app.get('/api/openapi.yaml', (_req, res) => {
  const override = process.env.OPENAPI_SPEC_PATH;
  let candidates: string[] = [];
  if (override && override.trim().length > 0) {
    candidates.push(path.resolve(override));
  }
  // ts-node (backend/src)
  candidates.push(path.resolve(__dirname, '../../docs/openapi.yaml'));
  // compiled (backend/dist/src)
  candidates.push(path.resolve(__dirname, '../../../docs/openapi.yaml'));

  const chosen = candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });
  if (!chosen) {
    return res.status(404).json({ error: { code: 'not_found', message: 'OpenAPI spec not found' } });
  }
  res.sendFile(chosen);
});
app.get('/api/docs', (_req, res) => {
  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Celebrate API Docs</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <style> body { margin: 0; } #swagger-ui { max-width: 100%; } </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.ui = SwaggerUIBundle({
          url: '/api/openapi.yaml',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis],
        });
      </script>
    </body>
  </html>`;
  // Relaxed CSP for Swagger UI (allow CDN + minimal inline)
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https: 'unsafe-inline'; script-src 'self' https://unpkg.com 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});

// Root info
app.get('/', (_req, res) => {
  res.json({
    name: 'Celebrate API',
    health: '/api/health',
    endpoints: ['/api/venues', '/api/bookings', '/api/payments/intent', '/api/payments/confirm'],
  });
});

// Auth (mock login by email)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // create a simple user if not exists (dev convenience)
    user = await prisma.user.create({ data: { id: 'u' + Math.random().toString(36).slice(2,7), role: 'user', name: email?.split('@')[0] ?? 'User', email } });
  }
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

// Who am I
app.get('/api/auth/me', auth(['user','owner','admin']), async (req: any, res) => {
  const { sub, role, name } = req.user || {};
  if (!sub) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: { id: sub, role, name } });
});

// Venues search/filter with validated query params (now with pagination & sorting)
const asOptionalNonEmpty = (schema: z.ZodTypeAny) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
const VenueQuerySchema = z.object({
  city: asOptionalNonEmpty(z.string().min(1)),
  q: asOptionalNonEmpty(z.string().min(1)),
  minCap: z.coerce.number().int().nonnegative().optional(),
  maxCap: z.coerce.number().int().nonnegative().optional(),
  amenity: asOptionalNonEmpty(z.string().min(1)),
  eventType: asOptionalNonEmpty(z.string().min(1)),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
  sort: asOptionalNonEmpty(z.string().min(1)), // e.g., name | -name | city | -createdAt
});
app.get('/api/venues', async (req, res) => {
  const parsed = VenueQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return badRequest(res, 'invalid_query', 'Invalid query parameters', parsed.error.flatten());
  }
  const { city, q, minCap, maxCap, amenity, eventType } = parsed.data;
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 20;
  const sort = parsed.data.sort;

  const where: any = { isDeleted: false };
  if (minCap !== undefined || maxCap !== undefined) {
    where.capacity = { gte: minCap ?? undefined, lte: maxCap ?? undefined };
  }

  // Build orderBy from sort string
  let orderBy: any = undefined;
  if (sort) {
    const desc = sort.startsWith('-');
    const key = desc ? sort.slice(1) : sort;
    const allowed = new Set(['name', 'city', 'createdAt', 'basePrice', 'rating', 'capacity']);
    if (allowed.has(key)) {
      orderBy = { [key]: desc ? 'desc' : 'asc' } as any;
    }
  }

  // Fetch from DB, then apply amenity/eventType filters in-memory (arrays are stringified in DB)
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.venue.findMany({ where: where as any, orderBy, skip, take: pageSize }),
    prisma.venue.count({ where: where as any }),
  ]);
  const cityLc = city ? city.toLowerCase() : null;
  const qLc = q ? q.toLowerCase() : null;
  const hydrated = rows.map(hydrateVenue);
  const filtered = hydrated.filter((v: any) => {
    const vCity = (v.city || '').toString().toLowerCase();
    const vName = (v.name || '').toString().toLowerCase();
    if (cityLc && vCity !== cityLc) return false;
    if (qLc && !vName.includes(qLc)) return false;
    const a: string[] = (v as any).amenities ?? [];
    const e: string[] = (v as any).eventTypes ?? [];
    if (amenity && !a.includes(String(amenity))) return false;
    if (eventType && !e.includes(String(eventType))) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  res.json({ items: filtered, page, pageSize, total, totalPages });
});

app.get('/api/venues/:id', async (req, res) => {
  const row = await prisma.venue.findFirst({ where: { id: req.params.id, isDeleted: false } as any });
  if (!row) return notFound(res);
  const v = hydrateVenue(row as any);
  return res.json(v);
});

// Owner: create/update venue (simplified)
app.post('/api/venues', auth(['owner','admin']), async (req: any, res) => {
  const parsed = VenueCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, 'invalid_request', 'Invalid request', parsed.error.flatten());
  }
  try {
    // ...
    const id = crypto.randomUUID();
    const b = parsed.data;
    // Ensure owner exists to satisfy FK when token is minted externally (E2E)
    const ownerId = req.user?.sub as string | undefined;
    if (!ownerId) return unauthorized(res);
    const existingOwner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!existingOwner) {
      await prisma.user.create({
        data: {
          id: ownerId,
          role: req.user?.role || 'owner',
          name: req.user?.name || 'Owner',
          email: `${ownerId}@local.test`,
        },
      });
    }
    const created = await prisma.venue.create({ data: {
      id,
      name: b.name,
      city: b.city,
      country: b.country,
      capacity: b.capacity ?? 0,
      amenities: JSON.stringify(b.amenities ?? []),
      eventTypes: JSON.stringify(b.eventTypes ?? []),
      images: JSON.stringify(b.images ?? []),
      description: b.description ?? '',
      basePrice: b.basePrice ?? 0,
      ownerId: ownerId,
      rating: b.rating ?? 0,
    }});
    return res.status(201).json(hydrateVenue(created as any));
  } catch (e: any) {
    logError('Create venue error', { error: (e as any)?.message });
    return internalError(res, 'Failed to create venue');
  }
});

// Owner/Admin: update venue
app.put('/api/venues/:id', auth(['owner','admin']), async (req: any, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.venue.findFirst({ where: { id, isDeleted: false } as any });
    if (!existing) return notFound(res);
    // ...
    const parsed = VenueCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, 'invalid_request', 'Invalid request', parsed.error.flatten());
    }
    const b = parsed.data as any;
    const updated = await prisma.venue.update({ where: { id }, data: {
      name: b.name ?? existing.name,
      city: b.city ?? existing.city,
      country: b.country ?? existing.country,
      capacity: b.capacity ?? (existing as any).capacity,
      basePrice: b.basePrice ?? (existing as any).basePrice,
      rating: b.rating ?? (existing as any).rating,
      images: b.images ? JSON.stringify(b.images) : (existing as any).images,
      amenities: b.amenities ? JSON.stringify(b.amenities) : (existing as any).amenities,
      eventTypes: b.eventTypes ? JSON.stringify(b.eventTypes) : (existing as any).eventTypes,
    }});
    return res.json(hydrateVenue(updated as any));
  } catch (e) {
    logError('Update venue error', { error: (e as any)?.message });
    return internalError(res, 'Failed to update venue');
  }
});

// Bookings
app.post('/api/bookings', auth(['user','admin']), async (req: any, res) => {
  const parsed = BookingCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    logWarn('bookings invalid request body', { body: req.body, issues: parsed.error?.issues });
    return badRequest(res, 'invalid_request', 'Invalid request', parsed.error.flatten());
  }
  const { venueId, date, guests } = parsed.data;
  // basic guards
  const today = new Date(); today.setHours(0,0,0,0);
  if (date < today) {
    logInfo('bookings rejected: past date', { date: date.toISOString(), today: today.toISOString() });
    return badRequest(res, 'invalid_date', 'Date must be today or later');
  }

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    logInfo('bookings rejected: invalid venue', { venueId });
    return badRequest(res, 'invalid_venue', 'Invalid venue');
  }
  if ((venue as any).capacity && guests > (venue as any).capacity) {
    logInfo('bookings rejected: guests exceed capacity', { guests, capacity: (venue as any).capacity });
    return badRequest(res, 'capacity_exceeded', 'Guests exceed capacity');
  }
  // prevent double booking for same date (day granularity)
  const isoDay = date.toISOString().slice(0,10);
  const exists = await prisma.booking.findFirst({ where: { venueId, date: { gte: new Date(isoDay), lt: new Date(new Date(isoDay).getTime() + 24*60*60*1000) } } });
  if (exists) {
    logInfo('bookings rejected: date already booked', { venueId, isoDay });
    return badRequest(res, 'date_already_booked', 'Date already booked');
  }

  // Ensure user exists to satisfy FK if token was minted without prior login
  const userId = req.user?.sub as string | undefined;
  if (!userId) {
    logInfo('bookings rejected: missing userId in token');
    return unauthorized(res);
  }
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    await prisma.user.create({ data: {
      id: userId,
      role: req.user?.role || 'user',
      name: req.user?.name || 'User',
      email: `${userId}@local.test`,
    }});
  }

  try {
    const id = 'b' + Math.random().toString(36).slice(2,7);
    const totalPriceGBP = (venue as any).basePrice as number;
    const booking = await prisma.booking.create({ data: {
      id,
      userId,
      venueId,
      date,
      guests,
      status: 'pending',
      totalPriceGBP
    }});
    res.status(201).json(booking);
  } catch (e: any) {
    if (e?.code === 'P2003') {
      logInfo('bookings rejected: FK violation', { venueId, userId });
      return badRequest(res, 'invalid_fk', 'Invalid user or venue');
    }
    logError('Create booking error', { error: (e as any)?.message });
    return internalError(res, 'Failed to create booking');
  }
});

app.get('/api/bookings/me', auth(['user','admin']), async (req: any, res) => {
  const my = await prisma.booking.findMany({ where: { userId: req.user.sub }, orderBy: { date: 'desc' } });
  res.json({ items: my });
});

// Payments (Stripe test mode)
app.post('/api/payments/intent', paymentsLimiter, auth(['user','admin']), async (req: any, res) => {
  try {
    const parsed = PaymentIntentSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, 'invalid_request', 'Invalid request', parsed.error.flatten());
    const { bookingId } = parsed.data;
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: req.user.sub } });
    if (!booking) return notFound(res, 'Booking not found');

    const amountGBP = booking.totalPriceGBP;
    const amount = Math.round(amountGBP * 100); // pence

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'gbp',
      metadata: { bookingId },
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (e: any) {
    logError('Create PI error', { error: (e as any)?.message });
    internalError(res, 'Failed to create payment intent');
  }
});

app.post('/api/payments/confirm', paymentsLimiter, auth(['user','admin']), async (req: any, res) => {
  const parsed = PaymentIntentSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, 'invalid_request', 'Invalid request', parsed.error.flatten());
  const { bookingId } = parsed.data;
  const booking = await prisma.booking.update({ where: { id: bookingId }, data: { status: 'confirmed' } }).catch(() => null);
  if (!booking || booking.userId !== req.user.sub) return notFound(res, 'Booking not found');
  res.json(booking);
});

// Admin: list venues, approve (stubs)
app.get('/api/admin/venues', auth(['admin']), async (_req, res) => {
  const items = await prisma.venue.findMany({ where: { isDeleted: false } as any });
  res.json({ items });
});

// Admin moderation stubs (no schema change yet)
app.post('/api/admin/venues/:id/approve', auth(['admin']), async (req, res) => {
  const id = req.params.id;
  const existing = await prisma.venue.findFirst({ where: { id, isDeleted: false } as any });
  if (!existing) return notFound(res);
  const updated = await prisma.venue.update({ where: { id }, data: { status: 'approved' } as any });
  res.json({ ok: true, item: hydrateVenue(updated as any) });
});
app.post('/api/admin/venues/:id/suspend', auth(['admin']), async (req, res) => {
  const id = req.params.id;
  const existing = await prisma.venue.findFirst({ where: { id, isDeleted: false } as any });
  if (!existing) return notFound(res);
  const updated = await prisma.venue.update({ where: { id }, data: { status: 'suspended' } as any });
  res.json({ ok: true, item: hydrateVenue(updated as any) });
});

// Owner/Admin: soft delete venue
app.delete('/api/venues/:id', auth(['owner','admin']), async (req: any, res) => {
  const id = req.params.id;
  const existing = await prisma.venue.findFirst({ where: { id, isDeleted: false } as any });
  if (!existing) return notFound(res);
  if (req.user?.role !== 'admin' && existing.ownerId !== req.user?.sub) {
    return forbidden(res);
  }
  const updated = await prisma.venue.update({ where: { id }, data: { isDeleted: true } as any });
  res.json({ ok: true, item: hydrateVenue(updated as any) });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Celebrate API running on http://localhost:${PORT}`);
  });
}

export default app;
