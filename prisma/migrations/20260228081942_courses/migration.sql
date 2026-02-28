/*
  Warnings:

  - You are about to drop the column `orderIndex` on the `Module` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CourseMode" AS ENUM ('SYNC', 'ASYNC');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('QUIZ', 'ESSAY', 'PROJECT', 'DISCUSSION', 'OTHER');

-- CreateEnum
CREATE TYPE "GradebookStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CLASS', 'DEADLINE', 'EXAM', 'OTHER');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "mode" "CourseMode" NOT NULL DEFAULT 'ASYNC';

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "orderIndex",
ADD COLUMN     "contentJson" JSONB,
ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AssignmentType" NOT NULL DEFAULT 'OTHER',
    "dueDate" TIMESTAMP(3),
    "rubricJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "grade" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradebookEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "finalGrade" TEXT,
    "status" "GradebookStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradebookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "type" "CalendarEventType" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_moduleId_idx" ON "Assignment"("moduleId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_idx" ON "Submission"("assignmentId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_studentId_idx" ON "Submission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "GradebookEntry_courseId_idx" ON "GradebookEntry"("courseId");

-- CreateIndex
CREATE INDEX "GradebookEntry_studentId_idx" ON "GradebookEntry"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GradebookEntry_courseId_studentId_key" ON "GradebookEntry"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_idx" ON "CalendarEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CalendarEvent_tenantId_startTime_idx" ON "CalendarEvent"("tenantId", "startTime");

-- CreateIndex
CREATE INDEX "Course_tenantId_createdBy_idx" ON "Course"("tenantId", "createdBy");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradebookEntry" ADD CONSTRAINT "GradebookEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
