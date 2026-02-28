import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canApproveOnboarding } from "@/lib/platform-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canApproveOnboarding(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A reason for rejection is required." },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const request = await prisma.onboardingRequest.findUnique({
      where: { id },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "Request is not pending." },
        { status: 400 }
      );
    }

    await prisma.onboardingRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Reject onboarding request error:", e);
    return NextResponse.json(
      { error: "Failed to reject request." },
      { status: 500 }
    );
  }
}
