# SILS — Student Information and Learning System

AI-native multi-tenant SaaS combining LMS and optional unified SIS.

## Stack

- **Frontend:** Next.js 15 App Router, TypeScript, Tailwind, Shadcn/UI, TanStack Query, Zod, MUI X Data Grid, PWA (offline-first, low-bandwidth)
- **Database:** Supabase Postgres with PGVector
- **ORM:** Prisma (`pgvector` for vector search via raw queries)
- **Auth:** Clerk (Organizations for multi-tenancy)

## Monorepo

- `apps/web` — Next.js 15 app
- `packages/shared-types` — Shared TypeScript types
- `prisma` — Schema and migrations (PGVector enabled)

## Setup

1. Copy env and configure:
   ```bash
   cp .env.example .env
   ```
   Set `DATABASE_URL` (Supabase Postgres), Clerk keys, and optional Supabase anon key.

2. Install and generate Prisma client:
   ```bash
   npm install
   npm run db:generate
   ```

3. Run migrations (after DB is reachable):
   ```bash
   npm run db:push
   # or
   npm run db:migrate
   ```

4. Start the app:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — Start Next.js (apps/web)
- `npm run build` — Build apps/web
- `npm run db:generate` — Generate Prisma client
- `npm run db:push` — Push schema to DB (dev)
- `npm run db:migrate` — Run migrations
- `npm run db:studio` — Open Prisma Studio

## Tenant detection

- **Subdomain:** `acme.sils.app` → tenant slug `acme`
- **Header:** `x-tenant-slug: acme`

Health check: `GET /api/health` → `{ "status": "ok", "timestamp": "..." }`.
