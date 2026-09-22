import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const traceId = crypto.randomUUID();
  const auth = req.headers.get('x-fyk-cron-token') || req.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized cron", traceId }), { status: 401, headers: { "Content-Type": "application/json" } });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date().toISOString();
    
    const results = {};

    // Board posts expired
    const { count: boardCount } = await supabase.from('board_posts').delete().lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.board = boardCount;

    // Shouts expired
    const { count: shoutsCount } = await supabase.from('shouts').delete().lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.shouts = shoutsCount;

    // Ephemeral messages
    const { count: ephemeralCount } = await supabase.from('messages').delete().eq('is_ephemeral', true).lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.ephemeral = ephemeralCount;

    // Check-ins expired
    const { count: checkinCount } = await supabase.from('check_ins').delete().lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.checkins = checkinCount;

    // Emergency shares expired
    const { count: emergencyCount } = await supabase.from('emergency_shares').delete().lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.emergency = emergencyCount;

    // MeetNow expired
    const { count: meetnowCount } = await supabase.from('meetnow').delete().lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.meetnow = meetnowCount;

    // Sessions expired
    const { count: sessionsCount } = await supabase.from('sessions').delete().lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.sessions = sessionsCount;

    // Stories expired
    const { count: storiesCount } = await supabase.from('stories').delete().lt('expires_at', now).select('*', { count: 'exact', head: true });
    results.stories = storiesCount;

    await supabase.from('cleanup_logs').insert({ trace_id: traceId, results, cleaned_at: now });

    return new Response(JSON.stringify({ ok: true, cleaned: results, traceId, predictive: { autoInfer: 'Expired data cleaned, storage optimized', recognizePatterns: Object.keys(results) } }), { status: 200, headers: { "Content-Type": "application/json", "X-Trace-Id": traceId } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, traceId }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});