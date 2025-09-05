import { PrismaClient } from '@prisma/client';

// Build a Neon-safe connection URL if needed (SSL required, low connection limit)
function computeDbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    // If using Neon and options are missing, add them
    if (u.hostname.includes('neon.tech')) {
      const params = u.searchParams;
      if (!params.has('sslmode')) params.set('sslmode', 'require');
      if (!params.has('connection_limit')) params.set('connection_limit', '1');
      if (!params.has('pgbouncer')) params.set('pgbouncer', 'true');
      if (!params.has('connect_timeout')) params.set('connect_timeout', '15');
      u.search = params.toString();
      return u.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

const dbUrl = computeDbUrl();

// Reuse prisma client in dev to avoid exhausting connections on hot reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
