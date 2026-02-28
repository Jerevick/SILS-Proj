-- DeploymentMode: replace CLOUD, SELF_HOSTED, HYBRID with SIS, LMS, HYBRID
CREATE TYPE "DeploymentMode_new" AS ENUM ('SIS', 'LMS', 'HYBRID');

ALTER TABLE "Tenant" ADD COLUMN "deploymentMode_new" "DeploymentMode_new";

UPDATE "Tenant" SET "deploymentMode_new" = 
  CASE "deploymentMode"
    WHEN 'CLOUD' THEN 'LMS'::"DeploymentMode_new"
    WHEN 'SELF_HOSTED' THEN 'LMS'::"DeploymentMode_new"
    WHEN 'HYBRID' THEN 'HYBRID'::"DeploymentMode_new"
  END;

ALTER TABLE "Tenant" DROP COLUMN "deploymentMode";
ALTER TABLE "Tenant" RENAME COLUMN "deploymentMode_new" TO "deploymentMode";
ALTER TABLE "Tenant" ALTER COLUMN "deploymentMode" SET DEFAULT 'LMS';

DROP TYPE "DeploymentMode";
ALTER TYPE "DeploymentMode_new" RENAME TO "DeploymentMode";

-- OnboardingDeploymentMode: replace LMS_ONLY, HYBRID_BRIDGE, UNIFIED_BLENDED with SIS, LMS, HYBRID
CREATE TYPE "OnboardingDeploymentMode_new" AS ENUM ('SIS', 'LMS', 'HYBRID');

ALTER TABLE "OnboardingRequest" ADD COLUMN "deploymentMode_new" "OnboardingDeploymentMode_new";

UPDATE "OnboardingRequest" SET "deploymentMode_new" = 
  CASE "deploymentMode"
    WHEN 'LMS_ONLY' THEN 'LMS'::"OnboardingDeploymentMode_new"
    WHEN 'HYBRID_BRIDGE' THEN 'HYBRID'::"OnboardingDeploymentMode_new"
    WHEN 'UNIFIED_BLENDED' THEN 'HYBRID'::"OnboardingDeploymentMode_new"
  END;

ALTER TABLE "OnboardingRequest" DROP COLUMN "deploymentMode";
ALTER TABLE "OnboardingRequest" RENAME COLUMN "deploymentMode_new" TO "deploymentMode";

DROP TYPE "OnboardingDeploymentMode";
ALTER TYPE "OnboardingDeploymentMode_new" RENAME TO "OnboardingDeploymentMode";
