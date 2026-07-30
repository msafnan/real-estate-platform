import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Single shared PrismaClient instance (D-8).
 * Not instantiated at module import in a way that opens a connection until
 * first query — so the server (and /health) can boot even without a live DB.
 * A real connection is validated lazily via `connectDb()` when needed.
 */
export const prisma = new PrismaClient({
  log: env.isProd ? ['error'] : ['query', 'warn', 'error'],
});

/** Optional explicit connectivity check (used from Session 2+). */
export async function connectDb(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
