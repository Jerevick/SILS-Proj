import { NextResponse } from "next/server";

/**
 * Health check for load balancers and monitoring.
 * GET /api/health → { status: "ok", timestamp }
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
