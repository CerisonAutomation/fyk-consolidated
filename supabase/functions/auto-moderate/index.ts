import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const traceId = crypto.randomUUID();
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "X-Trace-Id": traceId } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { table, record, type } = await req.json();
    
    // Database trigger: auto-moderate new content
    if (!record || !record.content) {
      return new Response(JSON.stringify({ ok: true, skipped: true, traceId }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Fast path distilbert ~26MB ~30ms
    const fastResult = await fetch(`${SUPABASE_URL}/functions/v1/ai-intent-detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "x-user-id": record.author_id || record.user_id },
      body: JSON.stringify({ text: record.content, context: record.description }),
    }).then(r => r.json()).catch(() => ({ flagged: false, score: 0, categories: {} }));

    if (fastResult.flagged) {
      await supabase.from(table || 'moderation_queue').update({ moderation_status: 'flagged', moderation_score: fastResult.score, moderation_categories: fastResult.categories, moderated_at: new Date().toISOString(), trace_id: traceId }).eq('id', record.id);
      
      // Auto-block if severe
      if (fastResult.score > 0.9) {
        await supabase.from('safety_infractions').insert({ user_id: record.author_id || record.user_id, type: 'auto_moderate', score: fastResult.score, content: record.content.substring(0,500), trace_id: traceId });
      }
    } else {
      await supabase.from(table || 'moderation_queue').update({ moderation_status: 'approved', moderation_score: fastResult.score, moderated_at: new Date().toISOString(), trace_id: traceId }).eq('id', record.id);
    }

    return new Response(JSON.stringify({ ok: true, moderated: true, result: fastResult, traceId }), { status: 200, headers: { "Content-Type": "application/json", "X-Trace-Id": traceId } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, traceId }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});