/**
 * Prisma client singleton for SILS (Next.js).
 * DATABASE_URL in apps/web/.env.local — use Neon Postgres pooled URL.
 *
 * PGVector: use $queryRaw with pgvector for similarity search; embedding column is vector(1536).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
