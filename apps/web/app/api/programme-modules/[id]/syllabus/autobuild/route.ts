/**
 * POST /api/programme-modules/[id]/syllabus/autobuild — Run AI syllabus auto-build for a programme module.
 * Input: optional syllabusText in body (or use existing module.syllabusText).
 * Uses Claude to generate content outline, learning outcomes, assignments+rubrics, tests, pathways;
 * stores in ProgrammeModule.syllabusGeneratedJson and sets syllabusStatus to PENDING_REVIEW.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { buildSyllabusForProgrammeModule } from "@/lib/autobuild-programme-module-syllabus";
import { z } from "zod";

const bodySchema = z.object({
  syllabusText: z.string().min(1).max(100000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { role } = result.context;
  const canBuild =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canBuild) {
    return NextResponse.json(
      { error: "Insufficient role to run syllabus auto-build." },
      { status: 403 }
    );
  }

  const { id: moduleId } = await params;

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  const syllabusTextFromBody = parsed.success ? parsed.data.syllabusText : undefined;

  try {
    const moduleRecord = await prisma.programmeModule.findFirst({
      where: {
        id: moduleId,
        programme: {
          department: { tenantId: result.context.tenantId },
        },
      },
      include: {
        programme: {
          select: {
            curriculumJson: true,
          },
        },
      },
    });

    if (!moduleRecord) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const syllabusText =
      syllabusTextFromBody ?? moduleRecord.syllabusText ?? "";
    if (!syllabusText.trim()) {
      return NextResponse.json(
        {
          error:
            "No syllabus text provided. Upload or paste syllabus text and try again.",
        },
        { status: 400 }
      );
    }

    const programmeOutcomes =
      moduleRecord.programme.curriculumJson &&
      typeof moduleRecord.programme.curriculumJson === "object" &&
      "learningOutcomes" in moduleRecord.programme.curriculumJson &&
      Array.isArray(
        (moduleRecord.programme.curriculumJson as { learningOutcomes: unknown })
          .learningOutcomes
      )
        ? (
            (moduleRecord.programme.curriculumJson as {
              learningOutcomes: { text?: string }[];
            }).learningOutcomes ?? []
          ).map((o) => o.text ?? "")
        : undefined;

    const buildResult = await buildSyllabusForProgrammeModule({
      moduleId,
      syllabusText: syllabusText.trim(),
      programmeLearningOutcomes: programmeOutcomes?.filter(Boolean),
    });

    if (!buildResult.ok) {
      return NextResponse.json(
        { error: buildResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      moduleId: buildResult.moduleId,
      status: buildResult.status,
      message:
        "Syllabus content generated. Review and publish from the module syllabus page.",
    });
  } catch (e) {
    console.error("Syllabus autobuild API error:", e);
    return NextResponse.json(
      { error: "Failed to run syllabus auto-build." },
      { status: 500 }
    );
  }
}
