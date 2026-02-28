-- AlterTable
ALTER TABLE "OnboardingRequest" ADD COLUMN "invoiceAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRequest_invoiceAccessToken_key" ON "OnboardingRequest"("invoiceAccessToken");
