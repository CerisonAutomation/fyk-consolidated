import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const traceId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "X-Trace-Id": traceId } });
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || (await req.json().catch(() => ({}))).userId;
    
    if (!userId) return new Response(JSON.stringify({ error: "userId required", traceId }), { status: 400, headers: { "Content-Type": "application/json" } });

    const { data, count } = await supabase.from('safety_infractions').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
    
    const recent30Days = await supabase.from('safety_infractions').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString());
    
    const shouldBlock = (recent30Days.count || 0) >= 3;
    const toxicityAvg = data?.reduce((sum, r) => sum + (r.score || 0), 0) / (data?.length || 1);

    if (shouldBlock) {
      await supabase.from('blocked_users').upsert({ user_id: userId, reason: 'auto_block_3_infractions', blocked_at: new Date().toISOString(), trace_id: traceId }, { onConflict: 'user_id' });
    }

    return new Response(JSON.stringify({ count: count || 0, recent30Days: recent30Days.count || 0, shouldBlock, toxicityAvg, infractions: data, traceId, predictive: { autoInfer: shouldBlock ? 'High risk pattern, auto-block' : 'Low risk', recognizePatterns: data?.map(d => d.type) || [] } }), { status: 200, headers: { "Content-Type": "application/json", "X-Trace-Id": traceId } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, traceId }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});