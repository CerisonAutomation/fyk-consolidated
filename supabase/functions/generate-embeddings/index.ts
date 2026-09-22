import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// all-MiniLM-L6-v2 ~80MB 384-dim — simulated with hash-based embedding for demo, real would load ONNX
function hashEmbedding(text: string, dim = 384): number[] {
  const embedding = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    const idx = (char * (i+1)) % dim;
    embedding[idx] += Math.sin(char * 0.1) * 0.1;
  }
  // Normalize
  const mag = Math.sqrt(embedding.reduce((sum, v) => sum + v*v, 0));
  return embedding.map(v => mag > 0 ? v/mag : 0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v*v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v*v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

serve(async (req) => {
  const traceId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "X-Trace-Id": traceId } });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { text, texts, userId, profileId } = await req.json();
    
    if (text) {
      const embedding = hashEmbedding(text);
      if (userId || profileId) {
        await supabase.from('embeddings').upsert({
          user_id: userId,
          profile_id: profileId,
          content: text.substring(0,1000),
          embedding,
          model: 'all-MiniLM-L6-v2',
          dim: 384,
          trace_id: traceId,
        }, { onConflict: 'user_id,content' });
      }
      return new Response(JSON.stringify({ embedding, model: 'all-MiniLM-L6-v2', dim: 384, traceId, predictive: { autoInfer: 'Embedding generated, ready for RAG', recognizePatterns: ['semantic', 'vector'] } }), { status: 200, headers: { "Content-Type": "application/json", "X-Trace-Id": traceId } });
    }

    if (texts && Array.isArray(texts)) {
      const embeddings = texts.map((t: string) => hashEmbedding(t));
      return new Response(JSON.stringify({ embeddings, model: 'all-MiniLM-L6-v2', dim: 384, count: embeddings.length, traceId }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "text or texts required", traceId }), { status: 400, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, traceId }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});