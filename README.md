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
- **Request Demo** → `/onboarding`: deployment mode (SIS / LMS / Hybrid (SIS+LMS)) + institution details → submit as pending.
- **Super Admin** (`SUPER_ADMIN_CLERK_USER_IDS`) → `/admin/requests`: MUI Data Grid to Approve/Reject. On Approve: create Clerk Organization, create Tenant in Prisma, send welcome email (Resend) with dashboard URL.
- **Post sign-in redirect:** Super Admin → `/admin/dashboard`, Institution user → `/dashboard`; no org → `/no-organization`.
- Enable **Organizations** in the Clerk Dashboard for multi-tenancy.

---

## SILS Production Launch Checklist (Phase 29)

Use this checklist before going live. Ensure every item is verified for your environment.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| **Database (Neon)** | | |
| `DATABASE_URL` | Yes | Neon Postgres pooled URL (use `?sslmode=require`) |
| `DIRECT_URL` | Yes | Neon direct URL for migrations / Prisma |
| **Clerk (Auth)** | | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (frontend) |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (backend) |
| **Super Admin** | | |
| `SUPER_ADMIN_CLERK_USER_IDS` | For /admin | Comma-separated Clerk user IDs for platform admins |
| `SUPER_ADMIN_EMAILS` | Alternative | Comma-separated emails (matched to primary email) |
| **App URL** | | |
| `NEXT_PUBLIC_APP_URL` | Recommended | Full app URL (e.g. `https://app.sils.app`) |
| `NEXT_PUBLIC_APP_DOMAIN` | For subdomains | Root domain (e.g. `sils.app`) for tenant slugs |
| **AI (Orchestrator, course build, grading)** | | |
| `ANTHROPIC_API_KEY` | For AI | Claude via Anthropic (Phase 27 orchestrator, LLM router) |
| `OPENAI_API_KEY` | Optional | Fallback for LLM router |
| **Rate limit & cache** | | |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis token |
| **Email** | | |
| `RESEND_API_KEY` | For welcome email | Resend API key |
| `RESEND_FROM_EMAIL` | With Resend | Sender (e.g. `SILS <onboarding@yourdomain.com>`) |
| **Payments** | | |
| `STRIPE_SECRET_KEY` | For payments | Stripe secret key (test/live) |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Signing secret for `/api/webhooks/stripe` |
| **Live video** | | |
| `DAILY_API_KEY` | For live class | Daily.co API key (Phase 7 live sessions) |
| **Error tracking** | | |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry DSN (stub in layout; add `@sentry/nextjs` when ready) |
| **PWA** | | |
| `PWA_DISABLED` | Optional | Set `true` to disable PWA (e.g. in dev) |

### Feature flags (per-tenant)

- Stored in `FeatureFlags` / `featureFlagsJson` on Tenant: `sisEnabled`, `skillsGraphEnabled`, `pwaEnabled`, `lowBandwidthEnabled`, `schoolsEnabled`.

### Integrations to verify

1. **Clerk** — Organizations enabled; sign-in/sign-up redirects (`/auth/callback`, `/onboarding`); webhook (optional) for user sync.
2. **Neon** — PGVector extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`); connection pooling for app, direct URL for migrations.
3. **Stripe** — Webhook endpoint configured (`https://yourdomain.com/api/webhooks/stripe`); payment links or Checkout for invoices.
4. **Daily.co** — Room creation and token generation for live classes; CORS and domain allowlist if needed.
5. **Resend** — Domain verified; welcome email template and from address.
6. **Sentry** — Install `@sentry/nextjs`, set `NEXT_PUBLIC_SENTRY_DSN`, replace `SentryStub` in `app/layout.tsx` with real init.

### Pre-launch commands

```bash
npm install
npm run db:generate
npm run db:push   # or db:migrate for production migrations
npm run build
npm run start     # production
```

### E2E testing (Playwright)

From `apps/web`:

```bash
npm run e2e       # headless
npm run e2e:ui   # UI mode
```

Covers: onboarding flow, AI course/module surfaces, admissions, role-based dashboards, grading/finance/exams/registration/scheduling/analytics, beta signup.

### Monitoring & health

- **Production monitoring:** `/monitoring` (platform admins only) — health check (DB, Clerk, Stripe, Redis, AI, Daily.co), AI Orchestrator link, quick links to admin.
- **Health API:** `GET /api/health` → `{ "status": "ok", "timestamp": "..." }`.
- **Centralized logging:** Use `LogSystemEvent` and `LogErrorEvent` from `app/actions/monitoring-actions.ts` in agents and server actions.
- **Full system health check:** `RunFullSystemHealthCheck()` — AI-powered check across all modules; logs to `SystemLog`.

### Beta & pilot signup

- **Public beta waitlist:** `/beta` — form submits to `/api/beta/signup`, stored in `BetaWaitlist` table.
- **Institution onboarding:** `/onboarding` — full B2B request → `/admin/requests` for approval.

### AI Orchestrator (Phase 27)

- **Intelligence Hub:** `/ai/orchestrator` — central AI dashboard, proactive insights, global chat. Linked from sidebar and floating help button in dashboard shell.
- Ensure `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) is set for orchestrator and LLM router.

---

*Phases 0–29 integrated. SILS is production-ready with monitoring, E2E tests, beta signup, and launch checklist.*

