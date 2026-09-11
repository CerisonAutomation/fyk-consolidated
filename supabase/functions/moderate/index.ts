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

const HARD_WORDS = /\b(kill|murder|rape|bomb|terrorist|slur)\b/i;
const SOFT_WORDS = /\b(fuck|shit|damn|ass|bitch)\b/i;
const NSFW_WORDS = /\b(nude|naked|sex|porn|explicit)\b/i;
const SCAM_PATTERNS = /\b(send money|wire|crypto|paypal|gift card|move to)\b/i;

// ---------------------------------------------------------------------------
// Auth helper — validates the JWT and returns the authenticated user.
// Per docs: "Always validate JWT on server side — defense in depth"
// ---------------------------------------------------------------------------
async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

serve(async (req) => {
  // Handle CORS preflight (per docs: always handle OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check — moderate requires an authenticated user
    const user = await getUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { text } = await req.json();

    if (typeof text !== "string" || !text.trim()) {
      return new Response(
        JSON.stringify({ error: '"text" is required and must be a non-empty string.' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = {
      safe: true,
      confidence: 0.9,
      flags: [] as string[],
      action: "allow" as string,
    };

    if (HARD_WORDS.test(text)) {
      result.safe = false;
      result.confidence = 0.95;
      result.flags.push("hard_content");
      result.action = "block";
    } else if (SOFT_WORDS.test(text)) {
      result.confidence = 0.7;
      result.flags.push("soft_content");
      result.action = "review";
    } else if (NSFW_WORDS.test(text)) {
      result.flags.push("nsfw");
      result.action = "review";
    } else if (SCAM_PATTERNS.test(text)) {
      result.flags.push("scam_pattern");
      result.action = "flag";
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
