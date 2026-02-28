/**
 * Embeddings for Phase 9: competency vectors (1536-dim, OpenAI-compatible).
 * Used for PGVector similarity search, job mapping, and recommendations.
 */

import OpenAI from "openai";

const EMBEDDING_DIM = 1536;

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }
  const openai = new OpenAI({ apiKey });
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 dimensions
    input: text.slice(0, 8191),
  });
  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error("Unexpected embedding dimensions");
  }
  return vec;
}

export async function getEmbeddingOrNull(text: string): Promise<number[] | null> {
  try {
    return await getEmbedding(text);
  } catch {
    return null;
  }
}

export { EMBEDDING_DIM };
