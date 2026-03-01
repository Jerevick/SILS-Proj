import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const betaSignupSchema = z.object({
  email: z.string().email(),
  institutionName: z.string().min(1),
  contactName: z.string().optional(),
  role: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = betaSignupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { email, institutionName, contactName, role, notes } = parsed.data;
    await prisma.betaWaitlist.create({
      data: { email, institutionName, contactName: contactName ?? null, role: role ?? null, notes: notes ?? null },
    });
    return NextResponse.json({ ok: true, message: "You're on the list!" });
  } catch (e) {
    console.error("[beta signup]", e);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}
