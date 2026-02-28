import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canViewOnboarding } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId || !(await canViewOnboarding(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const requests = await prisma.onboardingRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tenant: {
          select: { id: true, slug: true, name: true, termsAcceptedAt: true },
        },
      },
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
