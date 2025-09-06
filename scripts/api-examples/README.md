# API Examples

These examples use curl/HTTPie to try the API locally. Update tokens/ids as needed.

## Login (get a token)

```bash
# curl
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com"}' | jq

# httpie
http POST :4000/api/auth/login email=dev@example.com
```

## Create venue (owner)

```bash
OWNER_ID=$(curl -s -X POST :4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com"}' | jq -r '.user.id')
OWNER_JWT=$(node -e "console.log(require('jsonwebtoken').sign({sub: '$OWNER_ID', role: 'owner', name: 'Owner'}, 'dev-secret'))")

curl -s -X POST :4000/api/venues \
  -H "Authorization: Bearer $OWNER_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Venue","description":"desc","city":"London","country":"UK","capacity":50,"basePrice":199,"images":[],"amenities":["wifi"],"eventTypes":["wedding"]}' | jq
```

## Create booking (user)

```bash
# login as user
USER_TOKEN=$(curl -s -X POST :4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"user@example.com"}' | jq -r '.token')

# pick a venue id from previous output and set date to tomorrow
VENUE_ID=v123
DATE=$(node -e "const d=new Date();d.setDate(d.getDate()+1);console.log(d.toISOString().slice(0,10))")

curl -s -X POST :4000/api/bookings \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"venueId\":\"$VENUE_ID\",\"date\":\"$DATE\",\"guests\":2}" | jq
```

## Request payment intent

```bash
BOOKING_ID=b123
curl -s -X POST :4000/api/payments/intent \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"bookingId\":\"$BOOKING_ID\"}" | jq
```

## Admin moderation

```bash
ADMIN_JWT=$(node -e "console.log(require('jsonwebtoken').sign({sub: 'admin', role: 'admin', name: 'Admin'}, 'dev-secret'))")
VENUE_ID=v123

# approve
curl -s -X POST :4000/api/admin/venues/$VENUE_ID/approve -H "Authorization: Bearer $ADMIN_JWT" | jq
# suspend
curl -s -X POST :4000/api/admin/venues/$VENUE_ID/suspend -H "Authorization: Bearer $ADMIN_JWT" | jq
```
