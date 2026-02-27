import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !SUPER_ADMIN_CLERK_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
