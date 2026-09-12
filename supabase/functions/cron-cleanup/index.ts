import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Scheduled maintenance. Runs the deletes that must happen whether or not
// anybody opens the app: expired sessions, expired stories, expired MeetNow
// posts, stale typing indicators, and the `user_stats` refresh that keeps the
// profile counters derived rather than client-written.
//
// Auth story, because this function *deletes other people's data* with the
// service role:
//   * Supabase defaults every function to `verify_jwt = true`, and an external
//     scheduler (a crontab, GitHub Actions, `curl` in a runbook) has no user JWT to
//     present. Left at the default, this function simply never runs — which is the
//     state this repository shipped in: `supabase/config.toml` declared no
//     `[functions.*]` section at all, so the cleanup documented as scheduled was
//     401-ing on every attempt.
//   * So `verify_jwt = false` is the correct setting, *and* it is only safe together
//     with the shared secret below: an unauthenticated URL that wipes expired rows
//     is a denial-of-service endpoint otherwise (and, at `*/5`, a free one).
//     `x-fyk-cron-token` must equal `CRON_INTERNAL_TOKEN`; unset means refuse.
//   * No `Access-Control-Allow-Origin` is returned: no browser is a caller here, and
//     `*` would only advertise the route.
//
// Idempotent by construction — every statement is a `delete … where expired` or a
// refresh — so a scheduler that retries is harmless, which is why there is no
// "last run" bookkeeping to get out of sync.
// ---------------------------------------------------------------------------

const INTERNAL_TOKEN = Deno.env.get("CRON_INTERNAL_TOKEN") ?? "";

/** Constant-time comparison: a 401 must not leak how much of a guess was right. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function reject(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return reject(405, "method not allowed");
  }

  if (!INTERNAL_TOKEN) {
    console.error("CRON_INTERNAL_TOKEN is not set – refusing to run maintenance");
    return reject(503, "Maintenance not configured");
  }
  if (!timingSafeEqual(req.headers.get("x-fyk-cron-token") ?? "", INTERNAL_TOKEN)) {
    return reject(401, "Invalid maintenance token");
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
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("cron-cleanup failed:", error);
    return reject(500, "Maintenance run failed");
  }
});
