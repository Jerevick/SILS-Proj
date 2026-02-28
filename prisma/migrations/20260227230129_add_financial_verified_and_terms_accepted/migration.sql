-- AlterTable
ALTER TABLE "OnboardingRequest" ADD COLUMN     "financialVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "financialVerifiedBy" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);
