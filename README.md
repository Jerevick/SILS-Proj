# SILS — Student Information and Learning System

AI-native multi-tenant SaaS combining LMS and optional unified SIS.

## Stack

- **Frontend:** Next.js 15 App Router, TypeScript, Tailwind, Shadcn/UI, TanStack Query, Zod, MUI X Data Grid, PWA (offline-first, low-bandwidth)
- **Database:** Neon Postgres with full PGVector
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
   Set `DATABASE_URL` and `DIRECT_URL` (Neon Postgres), and Clerk keys. For Phase 2 onboarding and super admin:
- `SUPER_ADMIN_CLERK_USER_IDS` — comma-separated Clerk user IDs for super admins (access `/admin`, approve onboarding).
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_DOMAIN` — for welcome email dashboard link (e.g. `https://[slug].sils.app`).
- Optional: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for welcome email on approval.

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

## Phase 2: Clerk Organizations & B2B onboarding

- **Sign In** (landing) → Clerk Sign In. Only users in an Organization can access the app.
- **Request Demo** → `/onboarding`: deployment mode (LMS-Only / Hybrid Bridge / Unified Blended) + institution details → submit as pending.
- **Super Admin** (`SUPER_ADMIN_CLERK_USER_IDS`) → `/admin/requests`: MUI Data Grid to Approve/Reject. On Approve: create Clerk Organization, create Tenant in Prisma, send welcome email (Resend) with dashboard URL.
- **Post sign-in redirect:** Super Admin → `/admin/dashboard`, Institution user → `/dashboard`; no org → `/no-organization`.
- Enable **Organizations** in the Clerk Dashboard for multi-tenancy.
