/**
 * POST /api/sync-to-sis — Real-time sync: when student completes a module or final grade is posted in LMS,
 * push to SIS (ProgrammeModuleGrade, transcript). Call this when publishing a course grade or recording completion.
 *
 * Body (option A): { courseId, studentId, finalGrade } — uses CourseProgrammeLink to find programme + module and upserts ProgrammeModuleGrade.
 * Body (option B): { programmeModuleId, studentId, grade?, completedAt? } — direct upsert to ProgrammeModuleGrade.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const bodySchemaA = z.object({
  courseId: z.string(),
  studentId: z.string(),
  finalGrade: z.string().min(1),
});

const bodySchemaB = z.object({
  programmeModuleId: z.string(),
  studentId: z.string(),
  grade: z.string().optional(),
  completedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { role } = result.context;
  const canSync =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canSync) {
    return NextResponse.json(
      { error: "Insufficient role to sync to SIS." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenantId = result.context.tenantId;
  const now = new Date();

  // Option B: direct programme module grade
  const parsedB = bodySchemaB.safeParse(body);
  if (parsedB.success) {
    const { programmeModuleId, studentId, grade, completedAt } = parsedB.data;
    try {
      const moduleRecord = await prisma.programmeModule.findFirst({
        where: {
          id: programmeModuleId,
          programme: {
            department: { tenantId },
          },
        },
      });
      if (!moduleRecord) {
        return NextResponse.json(
          { error: "Programme module not found or not in tenant." },
          { status: 404 }
        );
      }

      const completed = completedAt ? new Date(completedAt) : now;

      await prisma.programmeModuleGrade.upsert({
        where: {
          programmeModuleId_studentId: { programmeModuleId, studentId },
        },
        create: {
          programmeModuleId,
          studentId,
          grade: grade ?? null,
          completedAt: completed,
          syncedAt: now,
        },
        update: {
          ...(grade != null && { grade }),
          completedAt: completed,
          syncedAt: now,
        },
      });

      return NextResponse.json({
        ok: true,
        synced: "ProgrammeModuleGrade",
        programmeModuleId,
        studentId,
      });
    } catch (e) {
      console.error("Sync to SIS (direct) error:", e);
      return NextResponse.json(
        { error: "Failed to sync to SIS." },
        { status: 500 }
      );
    }
  }

  // Option A: from course grade via CourseProgrammeLink
  const parsedA = bodySchemaA.safeParse(body);
  if (!parsedA.success) {
    return NextResponse.json(
      {
        error:
          "Invalid body. Use { courseId, studentId, finalGrade } or { programmeModuleId, studentId, grade?, completedAt? }.",
      },
      { status: 400 }
    );
  }

  const { courseId, studentId, finalGrade } = parsedA.data;

  try {
    const link = await prisma.courseProgrammeLink.findFirst({
      where: {
        courseId,
        programme: {
          department: { tenantId },
        },
      },
      include: { programme: true },
    });

    if (!link) {
      return NextResponse.json(
        {
          error:
            "Course is not linked to a programme. Link the course to a programme (and optionally to a programme module) first.",
        },
        { status: 400 }
      );
    }

    // If linked to a specific programme module, sync grade to that module.
    if (link.programmeModuleId) {
      await prisma.programmeModuleGrade.upsert({
        where: {
          programmeModuleId_studentId: {
            programmeModuleId: link.programmeModuleId,
            studentId,
          },
        },
        create: {
          programmeModuleId: link.programmeModuleId,
          studentId,
          grade: finalGrade,
          completedAt: now,
          syncedAt: now,
        },
        update: {
          grade: finalGrade,
          completedAt: now,
          syncedAt: now,
        },
      });

      return NextResponse.json({
        ok: true,
        synced: "ProgrammeModuleGrade",
        programmeId: link.programmeId,
        programmeModuleId: link.programmeModuleId,
        studentId,
      });
    }

    // Otherwise we could create a programme-level transcript entry if we had a model.
    // For now, only sync when programmeModuleId is set.
    return NextResponse.json(
      {
        error:
          "Course is linked to programme but not to a specific module. Set programmeModuleId on the link to sync grades.",
      },
      { status: 400 }
    );
  } catch (e) {
    console.error("Sync to SIS (from course) error:", e);
    return NextResponse.json(
      { error: "Failed to sync to SIS." },
      { status: 500 }
    );
  }
}
