-- AlterTable (runs after agentic_ai_friction_mastery so InterventionBrief and StudentMasteryState exist)
ALTER TABLE "InterventionBrief" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StudentMasteryState" ALTER COLUMN "updatedAt" DROP DEFAULT;
