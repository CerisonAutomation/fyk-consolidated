import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const traceId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "X-Trace-Id": traceId } });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { userId, type } = await req.json();
    
    if (!userId) return new Response(JSON.stringify({ error: "userId required", traceId }), { status: 400, headers: { "Content-Type": "application/json" } });

    const isSuper = type === 'super';
    const duration = isSuper ? 30 : 30; // 30 min visibility, super 10x
    const multiplier = isSuper ? 10 : 3;
    const cost = isSuper ? 9.99 : 2.99;

    // Check wallet balance
    const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userId).single();
    if (wallet && wallet.balance < cost) {
      return new Response(JSON.stringify({ error: "Insufficient balance", cost, balance: wallet.balance, traceId }), { status: 409, headers: { "Content-Type": "application/json" } });
    }

    // Deduct via ledger
    const { data: ledgerEntry } = await supabase.from('wallet_ledger').insert({
      user_id: userId,
      type: 'purchase',
      amount: -cost,
      description: `${isSuper ? 'Super Boost' : 'Boost'} for MeetNow ${duration}min ${multiplier}x`,
      source: `meetnow-boost:${userId}:${Date.now()}`,
      trace_id: traceId,
    }).select().single();

    // Create boost
    const expiresAt = new Date(Date.now() + duration*60*1000).toISOString();
    const { data: boost } = await supabase.from('meetnow_boosts').insert({
      user_id: userId,
      type: isSuper ? 'super' : 'regular',
      multiplier,
      expires_at: expiresAt,
      cost,
      trace_id: traceId,
    }).select().single();

    // Update meetnow visibility
    await supabase.from('meetnow').upsert({
      user_id: userId,
      is_boosted: true,
      boost_multiplier: multiplier,
      boost_expires_at: expiresAt,
      trace_id: traceId,
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ ok: true, boost, ledger: ledgerEntry, expiresAt, multiplier, cost, traceId, predictive: { autoInfer: `${isSuper ? 'Super' : ''} Boost activated, 10x visibility`, recognizePatterns: ['boost', 'visibility'] } }), { status: 200, headers: { "Content-Type": "application/json", "X-Trace-Id": traceId } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, traceId }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});