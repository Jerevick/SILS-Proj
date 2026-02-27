import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function GET() {
  const { userId } = await auth();
  if (!userId || !SUPER_ADMIN_CLERK_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const requests = await prisma.onboardingRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { id: true, slug: true, name: true } } },
    });
    return NextResponse.json(requests);
  } catch (e) {
    console.error("List onboarding requests error:", e);
    return NextResponse.json(
      { error: "Failed to list requests." },
      { status: 500 }
    );
  }
}
