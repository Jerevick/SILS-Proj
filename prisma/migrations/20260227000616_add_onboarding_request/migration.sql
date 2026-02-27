-- CreateEnum
CREATE TYPE "OnboardingDeploymentMode" AS ENUM ('LMS_ONLY', 'HYBRID_BRIDGE', 'UNIFIED_BLENDED');

-- CreateEnum
CREATE TYPE "OnboardingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "OnboardingRequest" (
    "id" TEXT NOT NULL,
    "deploymentMode" "OnboardingDeploymentMode" NOT NULL,
    "institutionName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT NOT NULL,
    "website" TEXT,
    "approxStudents" INTEGER,
    "status" "OnboardingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "tenantId" TEXT,

    CONSTRAINT "OnboardingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRequest_slug_key" ON "OnboardingRequest"("slug");

-- CreateIndex
CREATE INDEX "OnboardingRequest_status_idx" ON "OnboardingRequest"("status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_createdAt_idx" ON "OnboardingRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
