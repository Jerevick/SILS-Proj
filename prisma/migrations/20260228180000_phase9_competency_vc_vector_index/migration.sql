-- Phase 9: Vector index on StudentCompetency.vector_embedding for similarity search (job mapping, recommendations).
-- Requires: CREATE EXTENSION IF NOT EXISTS vector; (already enabled on Neon).
-- Run after schema push. Uses HNSW for good recall/speed balance.

CREATE INDEX IF NOT EXISTS "StudentCompetency_vectorEmbedding_idx"
ON "StudentCompetency"
USING hnsw ("vectorEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
