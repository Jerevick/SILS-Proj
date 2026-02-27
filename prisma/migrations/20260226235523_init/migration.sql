-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'INSTRUCTOR', 'LEARNER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "DeploymentMode" AS ENUM ('CLOUD', 'SELF_HOSTED', 'HYBRID');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "deploymentMode" "DeploymentMode" NOT NULL DEFAULT 'CLOUD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "featureFlagsJson" JSONB,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sisEnabled" BOOLEAN NOT NULL DEFAULT false,
    "skillsGraphEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pwaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowBandwidthEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTenantRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTenantRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillNode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEdge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_clerkOrgId_key" ON "Tenant"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlags_tenantId_key" ON "FeatureFlags"("tenantId");

-- CreateIndex
CREATE INDEX "UserTenantRole_clerkUserId_idx" ON "UserTenantRole"("clerkUserId");

-- CreateIndex
CREATE INDEX "UserTenantRole_tenantId_idx" ON "UserTenantRole"("tenantId");

-- CreateIndex
CREATE INDEX "UserTenantRole_userId_idx" ON "UserTenantRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTenantRole_tenantId_clerkUserId_key" ON "UserTenantRole"("tenantId", "clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "Course_tenantId_idx" ON "Course"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_tenantId_slug_key" ON "Course"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

-- CreateIndex
CREATE INDEX "SkillNode_tenantId_idx" ON "SkillNode"("tenantId");

-- CreateIndex
CREATE INDEX "SkillNode_tenantId_externalId_idx" ON "SkillNode"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "SkillEdge_tenantId_idx" ON "SkillEdge"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEdge_tenantId_fromId_toId_key" ON "SkillEdge"("tenantId", "fromId", "toId");

-- AddForeignKey
ALTER TABLE "FeatureFlags" ADD CONSTRAINT "FeatureFlags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTenantRole" ADD CONSTRAINT "UserTenantRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTenantRole" ADD CONSTRAINT "UserTenantRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
