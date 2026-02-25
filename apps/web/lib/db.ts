/**
 * Prisma client singleton for SILS.
 * Use from API routes or server components (Next.js).
 *
 * For vector search, use the pgvector package with $queryRaw / $executeRaw:
 *   import pgvector from 'pgvector';
 *   const embedding = pgvector.toSql([...]);
 *   await prisma.$queryRaw`SELECT * FROM "SkillNode" ORDER BY embedding <-> ${embedding}::vector LIMIT 5`
 *
 * Run `npm run db:generate` from repo root to generate the client.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
