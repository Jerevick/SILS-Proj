-- CreateTable
CREATE TABLE "PlatformFinanceSettings" (
    "id" TEXT NOT NULL,
    "pricingPlans" JSONB,
    "paymentTerms" JSONB,
    "bankDetails" JSONB,
    "taxCompliance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFinanceSettings_pkey" PRIMARY KEY ("id")
);
