-- CreateEnum
CREATE TYPE "FrictionSignalType" AS ENUM ('DWELL_TIME', 'QUIZ_ERROR', 'HUDDLE_ACTIVITY', 'REPEAT_ATTEMPT', 'SKIP_OR_ABANDON', 'OTHER');

-- CreateEnum
CREATE TYPE "InterventionBriefType" AS ENUM ('MICRO_SCAFFOLD', 'ALTERNATIVE_EXPLANATION', 'BRANCHING_PATHWAY', 'LECTURER_INTERVENTION');

-- CreateEnum
CREATE TYPE "InterventionBriefStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "FrictionSignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "moduleId" TEXT,
    "courseId" TEXT,
    "signalType" "FrictionSignalType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrictionSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionBrief" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "moduleId" TEXT,
    "courseId" TEXT,
    "briefType" "InterventionBriefType" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "InterventionBriefStatus" NOT NULL DEFAULT 'PENDING',
    "createdByAgentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMasteryState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "moduleId" TEXT,
    "courseId" TEXT,
    "stateJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentMasteryState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrictionSignal_tenantId_studentId_idx" ON "FrictionSignal"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "FrictionSignal_tenantId_studentId_moduleId_idx" ON "FrictionSignal"("tenantId", "studentId", "moduleId");

-- CreateIndex
CREATE INDEX "FrictionSignal_createdAt_idx" ON "FrictionSignal"("createdAt");

-- CreateIndex
CREATE INDEX "InterventionBrief_tenantId_studentId_idx" ON "InterventionBrief"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "InterventionBrief_tenantId_status_idx" ON "InterventionBrief"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InterventionBrief_createdByAgentAt_idx" ON "InterventionBrief"("createdByAgentAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMasteryState_tenantId_studentId_moduleId_key" ON "StudentMasteryState"("tenantId", "studentId", "moduleId");

-- CreateIndex
CREATE INDEX "StudentMasteryState_tenantId_studentId_idx" ON "StudentMasteryState"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentMasteryState_tenantId_moduleId_idx" ON "StudentMasteryState"("tenantId", "moduleId");

-- AddForeignKey
ALTER TABLE "FrictionSignal" ADD CONSTRAINT "FrictionSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionBrief" ADD CONSTRAINT "InterventionBrief_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMasteryState" ADD CONSTRAINT "StudentMasteryState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
