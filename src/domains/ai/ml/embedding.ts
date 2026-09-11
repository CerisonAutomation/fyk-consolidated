/**
 * embedding.ts
 * Embedding generation for vector search.
 *
 * Production patterns per docs:
 *  - Uses Transformers.js feature-extraction pipeline with all-MiniLM-L6-v2
 *  - 384-dim normalized vectors matching pgvector column definitions
 *  - pooling: 'mean' and normalize: true for semantic search quality
 *  - Graceful fallback to hash-based embeddings when ML unavailable
 *  - Proper error categorization for embedding operations
 */

import { loadExtractor } from "./bootstrap";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Embedding dimensions - must match pgvector column definition (all-MiniLM-L6-v2) */
export const EMBEDDING_DIM = 384;

/** Fallback hash dimensions when ML is unavailable */
export const FALLBACK_DIM = 384;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Whether the ML model was used or hash fallback */
  source: "model" | "fallback";
}

// ---------------------------------------------------------------------------
// ML-based embedding (primary path)
// ---------------------------------------------------------------------------

/**
 * Generate a semantic embedding using Transformers.js feature-extraction.
 *
 * Uses the all-MiniLM-L6-v2 model which produces 384-dim normalized vectors,
 * matching the pgvector column definition in the database.
 *
 * Per docs: pooling: 'mean' averages token embeddings, normalize: true
 * ensures cosine similarity works correctly.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    return { embedding: new Array(EMBEDDING_DIM).fill(0), source: "model" };
  }

  try {
    const pipe = await loadExtractor();

    const output = await pipe(text, {
      pooling: "mean",
      normalize: true,
    });

    // Transformers.js returns a Tensor; extract the Float32Array data
    const data = output.data;
    const embedding: number[] = Array.from(
      data instanceof Float32Array ? data.slice(0, EMBEDDING_DIM) : (Array.from(data as ArrayLike<number>).slice(0, EMBEDDING_DIM)),
    );

    // Validate dimensions
    if (embedding.length !== EMBEDDING_DIM) {
      console.warn(
        `[embedding] Expected ${EMBEDDING_DIM} dims, got ${embedding.length}. Truncating/padding.`,
      );
      while (embedding.length < EMBEDDING_DIM) embedding.push(0);
      embedding.length = EMBEDDING_DIM;
    }

    return { embedding, source: "model" };
  } catch (err) {
    console.warn("[embedding] ML embedding failed, falling back to hash:", err);
    return { embedding: hashEmbedding(text), source: "fallback" };
  }
}

/**
 * Generate embeddings for multiple texts in batch.
 * More efficient than calling generateEmbedding in a loop.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  // Process in batches of 10 to manage memory
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(generateEmbedding));
    results.push(...batchResults);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Fallback hash-based embedding
// ---------------------------------------------------------------------------

/**
 * Hash-based embedding fallback when ML model is unavailable.
 * Uses FNV-1a hash for consistent token distribution.
 *
 * This produces the same 384-dim normalized vector as the original
 * implementation but with proper normalization per docs.
 */
export function hashEmbedding(text: string, dimensions: number = FALLBACK_DIM): number[] {
  const embedding = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    if (!word) continue;
    // FNV-1a hash
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) {
      h = Math.imul(h ^ word.charCodeAt(i), 16777619);
    }
    embedding[(h >>> 0) % dimensions] += 1;
  }

  // L2 normalize per docs pattern
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map((v) => v / (norm || 1));
}

// ---------------------------------------------------------------------------
// Legacy API (backward compatibility)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use generateEmbedding() instead for proper semantic embeddings.
 * Profile vector generation using FNV hash. Retained for backward compatibility.
 */
export function profileVector(text: string, out: Float32Array, offset: number): void {
  for (const token of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!token) continue;
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
    out[offset + ((h >>> 0) % EMBEDDING_DIM)] += 1;
  }
}

/**
 * @deprecated Use generateEmbedding() instead for proper semantic embeddings.
 * Query vector generation using FNV hash. Retained for backward compatibility.
 */
export function queryVector(q: string): Float32Array {
  const v = new Float32Array(EMBEDDING_DIM);
  for (const token of q.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!token) continue;
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
    v[(h >>> 0) % EMBEDDING_DIM] += 1;
  }
  return v;
}

export { EMBEDDING_DIM as SEARCH_DIM };
