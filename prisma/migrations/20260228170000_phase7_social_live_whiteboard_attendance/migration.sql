-- Phase 7: Social Learning, Live Classrooms, Whiteboard, Attendance
-- CreateEnum
CREATE TYPE "HuddleStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Huddle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" "HuddleStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Huddle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuddleMessage" (
    "id" TEXT NOT NULL,
    "huddleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuddleMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalRoomId" TEXT,
    "roomUrl" TEXT,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteboardSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "documentSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhiteboardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "engagementScore" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Huddle_tenantId_idx" ON "Huddle"("tenantId");
CREATE INDEX "Huddle_tenantId_status_idx" ON "Huddle"("tenantId", "status");
CREATE INDEX "Huddle_courseId_idx" ON "Huddle"("courseId");

-- CreateIndex
CREATE INDEX "HuddleMessage_huddleId_idx" ON "HuddleMessage"("huddleId");
CREATE INDEX "HuddleMessage_huddleId_createdAt_idx" ON "HuddleMessage"("huddleId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveSession_tenantId_idx" ON "LiveSession"("tenantId");
CREATE INDEX "LiveSession_tenantId_status_idx" ON "LiveSession"("tenantId", "status");
CREATE INDEX "LiveSession_courseId_idx" ON "LiveSession"("courseId");
CREATE INDEX "LiveSession_createdBy_idx" ON "LiveSession"("createdBy");

-- CreateIndex
CREATE INDEX "WhiteboardSession_tenantId_idx" ON "WhiteboardSession"("tenantId");
CREATE INDEX "WhiteboardSession_liveSessionId_idx" ON "WhiteboardSession"("liveSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_liveSessionId_studentId_key" ON "AttendanceRecord"("liveSessionId", "studentId");
CREATE INDEX "AttendanceRecord_liveSessionId_idx" ON "AttendanceRecord"("liveSessionId");
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- AddForeignKey
ALTER TABLE "Huddle" ADD CONSTRAINT "Huddle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Huddle" ADD CONSTRAINT "Huddle_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HuddleMessage" ADD CONSTRAINT "HuddleMessage_huddleId_fkey" FOREIGN KEY ("huddleId") REFERENCES "Huddle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhiteboardSession" ADD CONSTRAINT "WhiteboardSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhiteboardSession" ADD CONSTRAINT "WhiteboardSession_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
