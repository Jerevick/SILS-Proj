/**
 * Prisma seed — platform owner. Run fresh after deleting yourself from Clerk.
 *
 * Run: pnpm db:seed (or pnpm prisma db seed)
 *
 * Env (in apps/web/.env.local or root .env):
 *   DATABASE_URL — Postgres connection string
 *   CLERK_SECRET_KEY — Clerk secret key (required to create/lookup user)
 *   SEED_PLATFORM_OWNER_EMAIL — Email for platform owner (default: jerevick83@proton.me)
 *
 * Optional:
 *   SEED_PLATFORM_OWNER_USERNAME — Clerk username (default: Jerevick)
 *   SEED_PLATFORM_OWNER_FIRST_NAME — First name (default: Jeremiah Victor)
 *   SEED_PLATFORM_OWNER_LAST_NAME — Last name (default: Harding)
 *   SEED_PLATFORM_OWNER_CLERK_USER_ID — If set, user already exists in Clerk; we only ensure DB row.
 *   RESEND_API_KEY — To send credentials by email. If unset, password is printed to console.
 *
 * If SEED_PLATFORM_OWNER_CLERK_USER_ID is not set:
 *   - We look up Clerk user by email. If none, we create the user with a generated password.
 *   - We insert/update PlatformAdmin with role PLATFORM_OWNER.
 *   - We send credentials by email (or log the temp password if no Resend).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../apps/web/.env.local") });
config({ path: path.resolve(__dirname, "../.env") });
config();

const prisma = new PrismaClient();

const SEED_PLATFORM_OWNER_EMAIL =
  process.env.SEED_PLATFORM_OWNER_EMAIL?.trim().toLowerCase() ||
  "jerevick83@proton.me";
const SEED_PLATFORM_OWNER_USERNAME =
  process.env.SEED_PLATFORM_OWNER_USERNAME?.trim() || "Jerevick";
const SEED_PLATFORM_OWNER_FIRST_NAME =
  process.env.SEED_PLATFORM_OWNER_FIRST_NAME?.trim() || "Jeremiah Victor";
const SEED_PLATFORM_OWNER_LAST_NAME =
  process.env.SEED_PLATFORM_OWNER_LAST_NAME?.trim() || "Harding";
const SEED_PLATFORM_OWNER_CLERK_USER_ID =
  process.env.SEED_PLATFORM_OWNER_CLERK_USER_ID?.trim();
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY?.trim();

function generateSecurePassword(): string {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*";
  const bytes = randomBytes(16);
  let s = "";
  for (let i = 0; i < 14; i++) s += chars[bytes[i]! % chars.length];
  return s;
}

async function clerkListUsersByEmail(email: string): Promise<{ id: string } | null> {
  if (!CLERK_SECRET_KEY) return null;
  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string }[];
  const user = data[0];
  return user?.id ? { id: user.id } : null;
}

async function clerkCreateUser(params: {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ id: string }> {
  const { email, password, username, firstName, lastName } = params;
  if (!CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required to create a user.");
  }
  const body: Record<string, unknown> = {
    email_address: [email],
    username,
    password,
    skip_password_checks: false,
  };
  if (firstName) body.first_name = firstName;
  if (lastName) body.last_name = lastName;
  const res = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clerk create user failed: ${res.status} ${text}`);
  }
  const user = (await res.json()) as { id: string };
  return { id: user.id };
}

async function sendCredentialsEmail(
  to: string,
  tempPassword: string,
  firstName?: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const loginUrl = `${baseUrl}/sign-in`;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const html = `
    <p>${greeting}</p>
    <p>Your SILS platform owner account has been created (seed).</p>
    <p>Your temporary password:</p>
    <p><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</code></p>
    <p>Sign in here: <a href="${loginUrl}">${loginUrl}</a></p>
    <p>We recommend changing your password after first sign-in (account settings).</p>
    <p>— The SILS Team</p>
  `;
  if (!resendKey) {
    console.log("[SILS] RESEND_API_KEY not set. Credentials not emailed.");
    console.log("[SILS] Temporary password (save it):", tempPassword);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from:
          process.env.RESEND_FROM_EMAIL ?? "SILS <onboarding@resend.dev>",
        to: [to],
        subject: "Your SILS platform owner credentials",
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend error:", res.status, text);
      console.log("[SILS] Temporary password (save it):", tempPassword);
    }
  } catch (err) {
    console.error("Send email error:", err);
    console.log("[SILS] Temporary password (save it):", tempPassword);
  }
}

async function main() {
  if (!SEED_PLATFORM_OWNER_EMAIL) {
    throw new Error("SEED_PLATFORM_OWNER_EMAIL is required.");
  }

  let clerkUserId: string;
  let tempPassword: string | null = null;

  if (SEED_PLATFORM_OWNER_CLERK_USER_ID) {
    clerkUserId = SEED_PLATFORM_OWNER_CLERK_USER_ID;
    console.log("Using existing Clerk user ID from env.");
  } else {
    if (!CLERK_SECRET_KEY) {
      throw new Error(
        "CLERK_SECRET_KEY is required (e.g. in apps/web/.env.local). " +
          "Needed to create or look up the platform owner in Clerk."
      );
    }
    const existingClerk = await clerkListUsersByEmail(SEED_PLATFORM_OWNER_EMAIL);
    if (existingClerk) {
      clerkUserId = existingClerk.id;
      console.log("Found existing Clerk user for", SEED_PLATFORM_OWNER_EMAIL);
    } else {
      tempPassword = generateSecurePassword();
      const created = await clerkCreateUser({
        email: SEED_PLATFORM_OWNER_EMAIL,
        password: tempPassword,
        username: SEED_PLATFORM_OWNER_USERNAME,
        firstName: SEED_PLATFORM_OWNER_FIRST_NAME,
        lastName: SEED_PLATFORM_OWNER_LAST_NAME,
      });
      clerkUserId = created.id;
      console.log("Created Clerk user for", SEED_PLATFORM_OWNER_EMAIL);
    }
  }

  const existing = await prisma.platformAdmin.findUnique({
    where: { clerkUserId },
  });

  if (existing) {
    await prisma.platformAdmin.update({
      where: { id: existing.id },
      data: {
        email: SEED_PLATFORM_OWNER_EMAIL,
        role: "PLATFORM_OWNER",
        status: "ACTIVE",
      },
    });
    console.log("Updated platform owner:", SEED_PLATFORM_OWNER_EMAIL);
  } else {
    await prisma.platformAdmin.create({
      data: {
        clerkUserId,
        email: SEED_PLATFORM_OWNER_EMAIL,
        role: "PLATFORM_OWNER",
        status: "ACTIVE",
      },
    });
    console.log("Seeded platform owner:", SEED_PLATFORM_OWNER_EMAIL);
  }

  if (tempPassword) {
    await sendCredentialsEmail(
      SEED_PLATFORM_OWNER_EMAIL,
      tempPassword,
      SEED_PLATFORM_OWNER_FIRST_NAME
    );
    console.log("Credentials sent by email (or see log above if Resend skipped).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
