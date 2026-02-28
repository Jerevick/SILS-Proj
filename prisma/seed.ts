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

  // ----- Phase 10: XR Labs seed -----
  // Create sample XR labs when at least one programme exists.
  const firstProgramme = await prisma.programme.findFirst({
    include: {
      department: true,
      modules: { take: 1 },
      competencies: { take: 3 },
    },
  });

  if (firstProgramme) {
    const programmeModuleId = firstProgramme.modules[0]?.id ?? null;
    const competencyIds = firstProgramme.competencies.map((c) => c.id);

    const xrLabsToCreate = [
      {
        title: "Chemistry Lab: Molecular 3D",
        xrType: "THREE_D" as const,
        sceneConfig: {
          sky: { color: "#0a0a1a" },
          ground: { radius: 50, color: "#1e293b" },
          entities: [
            { tag: "a-box", position: "0 1.5 -3", color: "#00f5ff", width: "1", height: "1", depth: "1" },
            { tag: "a-sphere", position: "2 1 -4", color: "#a855f7", radius: "0.5" },
            { tag: "a-cylinder", position: "-2 0.5 -3", color: "#22c55e", radius: "0.5", height: "1" },
          ],
        },
        masteryMetrics: {
          competencyIds: competencyIds.length > 0 ? competencyIds : undefined,
          weightCorrect: 0.5,
          weightErrors: -0.2,
          weightTime: 0.1,
          masteryDelta: 0.15,
        },
      },
      {
        title: "VR Safety Walkthrough",
        xrType: "VR" as const,
        sceneConfig: {
          sky: { color: "#0f172a" },
          ground: { radius: 40, color: "#0f172a" },
          entities: [
            { tag: "a-box", position: "0 1 -2", color: "#f59e0b", width: "0.8", height: "0.8", depth: "0.8" },
            { tag: "a-sphere", position: "-1.5 0.8 -2.5", color: "#ef4444", radius: "0.4" },
          ],
        },
        masteryMetrics: {
          competencyIds: competencyIds.length > 0 ? competencyIds.slice(0, 1) : undefined,
          weightCorrect: 0.6,
          weightErrors: -0.25,
          masteryDelta: 0.12,
        },
      },
      {
        title: "AR Anatomy Overlay",
        xrType: "AR" as const,
        sceneConfig: {
          sky: { color: "#020617" },
          ground: { radius: 30, color: "#0c1222" },
          entities: [
            { tag: "a-sphere", position: "0 1.2 -1.5", color: "#06b6d4", radius: "0.3" },
            { tag: "a-box", position: "0.5 1 -2", color: "#8b5cf6", width: "0.4", height: "0.4", depth: "0.4" },
          ],
        },
        masteryMetrics: {
          competencyIds: competencyIds.length > 0 ? competencyIds.slice(0, 2) : undefined,
          weightCorrect: 0.5,
          weightTime: 0.15,
          masteryDelta: 0.1,
        },
      },
    ];

    const existingCount = await prisma.xR_Lab.count({
      where: { programmeId: firstProgramme.id },
    });
    if (existingCount === 0) {
      for (const lab of xrLabsToCreate) {
        await prisma.xR_Lab.create({
          data: {
            programmeId: firstProgramme.id,
            programmeModuleId,
            title: lab.title,
            xrType: lab.xrType,
            sceneConfig: lab.sceneConfig as object,
            masteryMetrics: lab.masteryMetrics as object,
          },
        });
      }
      console.log("Seeded", xrLabsToCreate.length, "XR labs for programme:", firstProgramme.name);
    } else {
      console.log("XR labs already exist for programme:", firstProgramme.name, "(skipped)");
    }
  } else {
    console.log("No programme found; skip XR lab seed. Create a programme first.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
