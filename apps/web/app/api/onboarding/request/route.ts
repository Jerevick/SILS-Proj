import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { onboardingRequestSchema } from "@/lib/onboarding-schema";
import { sendOnboardingRequestAcknowledgementEmail } from "@/lib/send-user-created-email";

function slugFromInstitutionName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base.length >= 2 ? base : "institution";
}

async function findAvailableSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let n = 1;
  for (;;) {
    const [existingRequest, existingTenant] = await Promise.all([
      prisma.onboardingRequest.findUnique({ where: { slug } }),
      prisma.tenant.findUnique({ where: { slug } }),
    ]);
    if (!existingRequest && !existingTenant) return slug;
    slug = `${baseSlug}-${n}`;
    n++;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = onboardingRequestSchema.safeParse({
      ...body,
      slug: (body.slug as string)?.toLowerCase().trim() || undefined,
      phone: body.phone || undefined,
      website: body.website || undefined,
      approxStudents:
        body.approxStudents === "" || body.approxStudents == null
          ? undefined
          : Number(body.approxStudents),
      yearFounded:
        body.yearFounded === "" || body.yearFounded == null
          ? undefined
          : Number(body.yearFounded),
      numberOfCampuses:
        body.numberOfCampuses === "" || body.numberOfCampuses == null
          ? undefined
          : Number(body.numberOfCampuses),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const baseSlug = (data.slug ?? slugFromInstitutionName(data.institutionName))
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = baseSlug.length >= 2
      ? await findAvailableSlug(baseSlug)
      : await findAvailableSlug("institution");

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
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        addressCity: data.addressCity || null,
        addressStateRegion: data.addressStateRegion || null,
        addressPostalCode: data.addressPostalCode || null,
        yearFounded: data.yearFounded ?? null,
        institutionType: data.institutionType || null,
        legalEntityName: data.legalEntityName || null,
        taxIdOrRegistrationNumber: data.taxIdOrRegistrationNumber || null,
        accreditationStatus: data.accreditationStatus || null,
        accreditationBody: data.accreditationBody || null,
        accreditationCertificateUrl: data.accreditationCertificateUrl || null,
        missionOrDescription: data.missionOrDescription || null,
        numberOfCampuses: data.numberOfCampuses ?? null,
      },
    });

    const contactEmail = data.contactEmail.trim().toLowerCase();
    const { sent, error } = await sendOnboardingRequestAcknowledgementEmail({
      to: contactEmail,
      recipientName: data.contactPerson,
      institutionName: data.institutionName,
    });
    if (!sent) {
      console.warn("[SILS] Onboarding acknowledgement email not sent:", error);
    }

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
