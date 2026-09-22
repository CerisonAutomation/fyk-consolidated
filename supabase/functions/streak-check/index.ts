import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcB - utcA) / (24*60*60*1000));
}

serve(async (req) => {
  const traceId = crypto.randomUUID();
  const auth = req.headers.get('x-fyk-cron-token') || req.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized cron", traceId }), { status: 401, headers: { "Content-Type": "application/json" } });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();

    // Get users with last active
    const { data: users } = await supabase.from('users').select('id, last_active, streak, xp').limit(1000);

    let updated = 0;
    let reset = 0;
    let rewards = 0;

    for (const user of users || []) {
      if (!user.last_active) continue;
      const lastActive = new Date(user.last_active);
      const days = daysBetween(lastActive, now);

      if (days === 1) {
        // Continue streak
        const newStreak = (user.streak || 0) + 1;
        const xpReward = Math.min(newStreak * 10, 100); // 10 XP per day, max 100
        await supabase.from('users').update({ streak: newStreak, xp: (user.xp || 0) + xpReward, last_streak_check: now.toISOString(), trace_id: traceId }).eq('id', user.id);
        await supabase.from('xp_rewards').insert({ user_id: user.id, amount: xpReward, reason: `streak_${newStreak}`, trace_id: traceId });
        updated++;
        rewards++;
      } else if (days > 1) {
        // Reset streak
        await supabase.from('users').update({ streak: 0, last_streak_check: now.toISOString(), trace_id: traceId }).eq('id', user.id);
        reset++;
      }
    }

    await supabase.from('streak_logs').insert({ trace_id: traceId, updated, reset, rewards, checked_at: now.toISOString() });

    return new Response(JSON.stringify({ ok: true, updated, reset, rewards, total: users?.length || 0, traceId, predictive: { autoInfer: `${updated} streaks continued, ${reset} reset, pattern recognized`, recognizePatterns: ['streak', 'xp', 'daily'] } }), { status: 200, headers: { "Content-Type": "application/json", "X-Trace-Id": traceId } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, traceId }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});