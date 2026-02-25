import { NextResponse } from "next/server";

/**
 * Health check for load balancers and monitoring.
 * GET /api/health → { status: "ok" }
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
