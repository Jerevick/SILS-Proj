-- AlterTable (Phase 8: Module dynamic content and pathways only)
ALTER TABLE "Module" ADD COLUMN     "adaptivePathways" JSONB,
ADD COLUMN     "dynamicContent" JSONB;

-- CreateTable
CREATE TABLE "StudentModuleProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION,
    "currentPathwayStep" INTEGER,
    "frictionHistory" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentModuleProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentModuleProgress_tenantId_studentId_idx" ON "StudentModuleProgress"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentModuleProgress_moduleId_idx" ON "StudentModuleProgress"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentModuleProgress_tenantId_studentId_moduleId_key" ON "StudentModuleProgress"("tenantId", "studentId", "moduleId");

-- AddForeignKey
ALTER TABLE "StudentModuleProgress" ADD CONSTRAINT "StudentModuleProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentModuleProgress" ADD CONSTRAINT "StudentModuleProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
