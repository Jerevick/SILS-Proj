-- AlterTable
ALTER TABLE "OnboardingRequest" ADD COLUMN "invoiceSnapshot" JSONB;

ALTER TABLE "OnboardingRequest" ADD COLUMN "receiptSnapshot" JSONB;
