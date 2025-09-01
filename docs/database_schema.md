# Database Schema (proposed)

- users(id, role, name, email, password_hash?, created_at)
- venues(id, owner_id, name, city, country, capacity, amenities[], event_types[], description, base_price, rating, images[], created_at)
- bookings(id, user_id, venue_id, date, guests, status, total_price_gbp, payment_intent_id?, created_at)
- messages(id, sender_id, recipient_id, booking_id?, body, created_at)
- payouts(id, owner_id, amount_gbp, currency, status, created_at)

Use PostgreSQL with Prisma. Multi-currency handled via FX rates and money columns per currency when needed.
