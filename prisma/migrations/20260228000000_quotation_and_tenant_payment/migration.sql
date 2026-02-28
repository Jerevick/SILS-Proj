-- AlterTable
ALTER TABLE "OnboardingRequest" ADD COLUMN "quotationSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3);
