-- AlterTable
ALTER TABLE "OnboardingRequest" ADD COLUMN "receiptAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRequest_receiptAccessToken_key" ON "OnboardingRequest"("receiptAccessToken");
