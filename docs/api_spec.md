# API Spec (MVP)

Base URL: http://localhost:4000

- GET /api/health → { ok }
- POST /api/auth/login { email } → { token, user }
- GET /api/venues?city=&q=&minCap=&maxCap=&amenity=&eventType=&page=&pageSize=&sort=
  - Returns: `{ items: Venue[], page, pageSize, total, totalPages }`
  - `sort` supports: `name`, `-name`, `city`, `-createdAt`, `basePrice`, `rating`, `capacity`
- GET /api/venues/:id → Venue & { availability: string[] }
- POST /api/venues (owner/admin) body: VenuePartial → Venue
- POST /api/bookings (user/admin) { venueId, date, guests } → Booking
- GET /api/bookings/me (user/admin) → { items: Booking[] }
- POST /api/payments/intent (user/admin) → { clientSecret }
- GET /api/admin/venues (admin) → { items: Venue[] }

Auth: Bearer token from POST /api/auth/login

Errors (standardized)
- Error responses use `{ error: { code, message, details? } }`
- Examples:
  - Validation: `{ error: { code: "invalid_request", message: "Invalid request", details: { fieldErrors... } } }`
  - Not found: `{ error: { code: "not_found", message: "Not found" } }`
  - Unauthorized/Forbidden: `{ error: { code: "unauthorized"|"forbidden", message } }`

Payments & Webhooks
- POST /api/payments/intent → `{ clientSecret }` (Stripe test mode)
- POST /api/payments/webhook (Stripe)
  - Requires `STRIPE_WEBHOOK_SECRET`
  - Idempotent by `event.id`; duplicate events return `{ received: true, duplicate: true }`

---

## Samples

### Login
Request
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com" }
```
Response
```json
{ "token": "<jwt>", "user": { "id": "u123", "role": "user", "name": "user" } }
```

### List venues with pagination & sorting
Request
```http
GET /api/venues?city=london&q=hall&page=1&pageSize=20&sort=-name
```
Response
```json
{
  "items": [
    { "id": "v1", "name": "Alpha Hall", "city": "London", "amenities": [], "eventTypes": [] }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1
}
```

### Standardized error (validation)
```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid request",
    "details": { "fieldErrors": { "name": ["Required"] } }
  }
}
```

### Webhook duplicate
First call
```json
{ "received": true }
```
Second call (same event.id)
```json
{ "received": true, "duplicate": true }
```

## Common error codes

| code                | status | description                                   |
|---------------------|--------|-----------------------------------------------|
| invalid_request     | 400    | Request validation failed                     |
| invalid_query       | 400    | Query parameter validation failed             |
| invalid_date        | 400    | Date must be today or later                   |
| invalid_venue       | 400    | Venue does not exist                          |
| capacity_exceeded   | 400    | Guests exceed capacity                        |
| date_already_booked | 400    | Venue already booked for the given date       |
| invalid_fk          | 400    | Related entity missing (user/venue)           |
| not_found           | 404    | Resource not found                            |
| unauthorized        | 401    | Missing/invalid credentials                   |
| forbidden           | 403    | Insufficient role/permissions                 |
| internal_error      | 500    | Unexpected server error                       |

## Additional endpoint examples

### Create venue (owner/admin)
Request
```http
POST /api/venues
Authorization: Bearer <owner-jwt>
Content-Type: application/json

{
  "name": "Grand Hall",
  "description": "Spacious",
  "city": "London",
  "country": "UK",
  "capacity": 120,
  "basePrice": 250,
  "images": [],
  "amenities": ["wifi"],
  "eventTypes": ["wedding"]
}
```
Response
```json
{ "id": "v123", "name": "Grand Hall", "city": "London", "amenities": ["wifi"], "eventTypes": ["wedding"] }
```

### Create booking (user)
Request
```http
POST /api/bookings
Authorization: Bearer <user-jwt>
Content-Type: application/json

{ "venueId": "v123", "date": "2025-12-31", "guests": 4 }
```
Response
```json
{ "id": "b123", "venueId": "v123", "status": "pending", "guests": 4 }
```
Error (double booking)
```json
{ "error": { "code": "date_already_booked", "message": "Date already booked" } }
```

### Admin moderation (approve/suspend)
Approve
```http
POST /api/admin/venues/:id/approve
Authorization: Bearer <admin-jwt>
```
Response
```json
{ "ok": true, "item": { "id": "v123", "status": "approved" } }
```
Suspend
```http
POST /api/admin/venues/:id/suspend
Authorization: Bearer <admin-jwt>
```
Response
```json
{ "ok": true, "item": { "id": "v123", "status": "suspended" } }
```
