import prisma from '../src/db';
import { afterAll, beforeAll } from 'vitest';

beforeAll(async () => {
  // no-op placeholder; DB is prepared by pretest npm script
});

afterAll(async () => {
  // Disconnect prisma once after the entire test run
  try {
    await prisma.$disconnect();
  } catch {}
});
