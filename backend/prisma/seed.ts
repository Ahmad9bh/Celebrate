import 'dotenv/config';
import prisma from '../src/db';
import { users, venues, bookings } from '../src/seed';

async function main() {
  // Upsert users by unique email to avoid conflicts if IDs differ in existing DB
  // Map seed user IDs to actual DB user IDs for FK consistency
  const userIdMap = new Map<string, string>();
  for (const u of users) {
    const up = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { id: u.id, name: u.name, email: u.email, role: u.role },
    });
    // If an existing user with same email had a different id, record the actual id
    userIdMap.set(u.id, up.id);
  }

  // Upsert venues
  for (const v of venues) {
    await prisma.venue.upsert({
      where: { id: v.id },
      update: {
        name: v.name,
        city: v.city,
        country: v.country,
        capacity: v.capacity,
        amenities: JSON.stringify(v.amenities),
        eventTypes: JSON.stringify(v.eventTypes),
        images: JSON.stringify(v.images),
        description: v.description,
        basePrice: v.basePrice,
        ownerId: userIdMap.get(v.ownerId) ?? v.ownerId,
        rating: v.rating,
      },
      create: {
        id: v.id,
        name: v.name,
        city: v.city,
        country: v.country,
        capacity: v.capacity,
        amenities: JSON.stringify(v.amenities),
        eventTypes: JSON.stringify(v.eventTypes),
        images: JSON.stringify(v.images),
        description: v.description,
        basePrice: v.basePrice,
        ownerId: userIdMap.get(v.ownerId) ?? v.ownerId,
        rating: v.rating,
      },
    });
  }

  // Upsert bookings
  for (const b of bookings) {
    await prisma.booking.upsert({
      where: { id: b.id },
      update: {
        userId: userIdMap.get(b.userId) ?? b.userId,
        venueId: b.venueId,
        date: new Date(b.date),
        guests: b.guests,
        status: b.status,
        totalPriceGBP: b.totalPriceGBP,
      },
      create: {
        id: b.id,
        userId: userIdMap.get(b.userId) ?? b.userId,
        venueId: b.venueId,
        date: new Date(b.date),
        guests: b.guests,
        status: b.status,
        totalPriceGBP: b.totalPriceGBP,
      },
    });
  }
}

main()
  .then(async () => {
    console.log('Seed complete');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
