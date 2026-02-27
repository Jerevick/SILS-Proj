import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { onboardingRequestSchema } from "@/lib/onboarding-schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = onboardingRequestSchema.safeParse({
      ...body,
      slug: (body.slug as string)?.toLowerCase().trim(),
      phone: body.phone || undefined,
      website: body.website || undefined,
      approxStudents:
        body.approxStudents === "" || body.approxStudents == null
          ? undefined
          : Number(body.approxStudents),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const slug = data.slug.toLowerCase().replace(/\s+/g, "-");

    const existing = await prisma.onboardingRequest.findUnique({
      where: { slug },
    });
    if (existing && existing.status === "PENDING") {
      return NextResponse.json(
        { error: "An onboarding request with this slug is already pending." },
        { status: 409 }
      );
    }

    const tenantWithSlug = await prisma.tenant.findUnique({
      where: { slug },
    });
    if (tenantWithSlug) {
      return NextResponse.json(
        { error: "This institution identifier (slug) is already in use." },
        { status: 409 }
      );
    }

    const onboardingRequest = await prisma.onboardingRequest.create({
      data: {
        deploymentMode: data.deploymentMode,
        institutionName: data.institutionName,
        slug,
        contactPerson: data.contactPerson,
        contactEmail: data.contactEmail,
        phone: data.phone || null,
        country: data.country,
        website: data.website || null,
        approxStudents: data.approxStudents ?? null,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        id: onboardingRequest.id,
        message:
          "Onboarding request submitted. You will receive an email once your institution is approved.",
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("Onboarding request error:", e);
    return NextResponse.json(
      { error: "Failed to submit onboarding request." },
      { status: 500 }
    );
  }
}
