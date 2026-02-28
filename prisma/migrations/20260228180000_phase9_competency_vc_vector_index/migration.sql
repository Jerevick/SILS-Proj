-- Phase 9: Portable Competency Graph + Verifiable Credentials (PGVector).
-- Creates Competency, StudentCompetency, VerifiableCredential and vector index.
-- Safe to run when tables already exist (from db push): uses IF NOT EXISTS.

-- Ensure vector extension exists (Neon usually has it)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enum for VC status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerifiableCredentialStatus') THEN
    CREATE TYPE "VerifiableCredentialStatus" AS ENUM ('ISSUED', 'REVOKED', 'EXPIRED');
  END IF;
END$$;

-- Competency (belongs to Programme)
CREATE TABLE IF NOT EXISTS "Competency" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "credits" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Competency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Competency_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Competency_programmeId_code_key" UNIQUE ("programmeId", "code")
);

CREATE INDEX IF NOT EXISTS "Competency_programmeId_idx" ON "Competency"("programmeId");

-- StudentCompetency (with vector embedding for similarity search)
CREATE TABLE IF NOT EXISTS "StudentCompetency" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "competencyId" TEXT NOT NULL,
  "masteryLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "evidenceJson" JSONB,
  "vectorEmbedding" vector(1536),
  "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentCompetency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentCompetency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentCompetency_tenantId_studentId_competencyId_key" UNIQUE ("tenantId", "studentId", "competencyId")
);

CREATE INDEX IF NOT EXISTS "StudentCompetency_tenantId_idx" ON "StudentCompetency"("tenantId");
CREATE INDEX IF NOT EXISTS "StudentCompetency_studentId_idx" ON "StudentCompetency"("studentId");
CREATE INDEX IF NOT EXISTS "StudentCompetency_competencyId_idx" ON "StudentCompetency"("competencyId");

-- VerifiableCredential
CREATE TABLE IF NOT EXISTS "VerifiableCredential" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "competencyId" TEXT NOT NULL,
  "vcJwt" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockchainTx" TEXT,
  "status" "VerifiableCredentialStatus" NOT NULL DEFAULT 'ISSUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifiableCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerifiableCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VerifiableCredential_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VerifiableCredential_tenantId_idx" ON "VerifiableCredential"("tenantId");
CREATE INDEX IF NOT EXISTS "VerifiableCredential_studentId_idx" ON "VerifiableCredential"("studentId");
CREATE INDEX IF NOT EXISTS "VerifiableCredential_competencyId_idx" ON "VerifiableCredential"("competencyId");
CREATE INDEX IF NOT EXISTS "VerifiableCredential_issuedAt_idx" ON "VerifiableCredential"("issuedAt");

-- Vector index for similarity search (job mapping, recommendations)
CREATE INDEX IF NOT EXISTS "StudentCompetency_vectorEmbedding_idx"
ON "StudentCompetency"
USING hnsw ("vectorEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
