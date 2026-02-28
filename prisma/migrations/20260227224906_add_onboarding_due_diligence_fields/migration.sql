/*
  Warnings:

  - Made the column `deploymentMode` on table `OnboardingRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deploymentMode` on table `Tenant` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "OnboardingRequest" ADD COLUMN     "accreditationBody" TEXT,
ADD COLUMN     "accreditationCertificateUrl" TEXT,
ADD COLUMN     "accreditationStatus" TEXT,
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "addressPostalCode" TEXT,
ADD COLUMN     "addressStateRegion" TEXT,
ADD COLUMN     "institutionType" TEXT,
ADD COLUMN     "legalEntityName" TEXT,
ADD COLUMN     "missionOrDescription" TEXT,
ADD COLUMN     "numberOfCampuses" INTEGER,
ADD COLUMN     "taxIdOrRegistrationNumber" TEXT,
ADD COLUMN     "yearFounded" INTEGER,
ALTER COLUMN "deploymentMode" SET NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "deploymentMode" SET NOT NULL;
