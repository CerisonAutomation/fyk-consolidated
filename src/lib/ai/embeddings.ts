/**
 * AI Embeddings — pgvector — all-MiniLM-L6-v2 384-dim
 * PRD 14.1
 */

export async function createEmbedding(text: string): Promise<number[]> {
  const res = await fetch("/api/ai/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  return data.embedding ?? [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

export async function findSimilar(query: string, candidates: Array<{ id: string; embedding: number[] }>, limit = 5) {
  const queryEmbedding = await createEmbedding(query);
  return candidates
    .map((c) => ({ ...c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
