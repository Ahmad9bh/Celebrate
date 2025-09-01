# API Spec (MVP)

Base URL: http://localhost:4000

- GET /api/health → { ok }
- POST /api/auth/login { email } → { token, user }
- GET /api/venues?city=&q=&minCap=&maxCap=&amenity=&eventType= → { items: Venue[] }
- GET /api/venues/:id → Venue & { availability: string[] }
- POST /api/venues (owner/admin) body: VenuePartial → Venue
- POST /api/bookings (user/admin) { venueId, date, guests } → Booking
- GET /api/bookings/me (user/admin) → { items: Booking[] }
- POST /api/payments/intent (user/admin) → { clientSecret }
- GET /api/admin/venues (admin) → { items: Venue[] }

Auth: Bearer token from POST /api/auth/login
