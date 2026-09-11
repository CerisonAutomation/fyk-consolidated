import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS headers — shared across all responses (per docs pattern)
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (_req) => {
  // Handle CORS preflight (per docs: always handle OPTIONS)
  if (_req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Use service_role for cleanup operations (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Cleanup expired sessions
    const { count: sessionsCleaned } = await supabase.rpc(
      "cleanup_expired_sessions",
    );

    // Cleanup expired stories
    const { count: storiesCleaned } = await supabase
      .from("stories")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Cleanup expired meetnow posts
    const { count: meetnowCleaned } = await supabase
      .from("meetnow_posts")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Cleanup stale typing indicators
    await supabase.rpc("cleanup_typing_indicators");

    // Refresh user stats materialized view
    await supabase.rpc("refresh_user_stats");

    return new Response(
      JSON.stringify({
        sessionsCleaned,
        storiesCleaned,
        meetnowCleaned,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
