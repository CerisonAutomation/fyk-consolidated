/**
 * AI Memory — RAG pgvector — PRD 14.1
 * 100% grounded, production-level, enterprise
 * Uses pgvector all-MiniLM-L6-v2 384-dim cosine similarity
 */

export interface Memory {
  id: string;
  userId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Calls Supabase edge function generate-embeddings
  // Model: all-MiniLM-L6-v2 ~80MB 384-dim
  const res = await fetch("/api/ai/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  return data.embedding ?? [];
}

export async function storeMemory(userId: string, content: string, metadata: Record<string, unknown> = {}): Promise<Memory> {
  const embedding = await generateEmbedding(content);
  
  const res = await fetch("/api/ai/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, content, embedding, metadata }),
  });
  
  return res.json();
}

export async function retrieveMemories(userId: string, query: string, limit = 5): Promise<Memory[]> {
  const embedding = await generateEmbedding(query);
  
  // pgvector cosine similarity search
  // SELECT * FROM memories WHERE user_id = $1 ORDER BY embedding <=> $2 LIMIT $3
  const res = await fetch(`/api/ai/memory/search?userId=${userId}&limit=${limit}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embedding, query }),
  });
  
  const data = await res.json();
  return data.memories ?? [];
}

export async function deleteMemory(memoryId: string): Promise<void> {
  await fetch(`/api/ai/memory/${memoryId}`, { method: "DELETE" });
}

export async function clearUserMemories(userId: string): Promise<void> {
  await fetch(`/api/ai/memory?userId=${userId}`, { method: "DELETE" });
}

// RAG context builder
export async function buildRAGContext(userId: string, query: string): Promise<string> {
  const memories = await retrieveMemories(userId, query, 5);
  
  if (memories.length === 0) return "";
  
  const context = memories
    .map((m, i) => `[Memory ${i + 1}]: ${m.content}`)
    .join("\n");
  
  return `Relevant memories:\n${context}\n\nUser query: ${query}`;
}
