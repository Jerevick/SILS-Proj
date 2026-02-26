import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * DB connection check. GET /api/db → { ok, message } or error details.
 * Use this to verify DATABASE_URL and that the schema is applied (Neon + PGVector).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      message: "Database connection OK",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: "Ensure DATABASE_URL is in apps/web/.env.local and schema is applied (e.g. prisma migrate deploy).",
      },
      { status: 503 }
    );
  }
}
