import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Configure VAPID credentials once at module level.
// These must be set as Supabase Edge Function secrets:
//   VITE_VAPID_PUBLIC_KEY  – base64-url public key (for reference)
//   VAPID_PRIVATE_KEY      – base64-url private key
//   VAPID_SUBJECT          – contact email/url, e.g. "mailto:admin@example.com"
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@fyk.app";

if (VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    VAPID_SUBJECT,
    Deno.env.get("VITE_VAPID_PUBLIC_KEY") ?? "",
    VAPID_PRIVATE_KEY,
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, title, body, href } = await req.json();

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: "userId and title are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Early exit if VAPID keys are not configured
    if (!VAPID_PRIVATE_KEY) {
      console.error("VAPID_PRIVATE_KEY is not set – cannot send push");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Store notification in the notifications table
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "push",
      title,
      body,
      href,
    });

    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError) {
      console.error("Error fetching subscriptions:", subError.message);
      return new Response(
        JSON.stringify({ error: subError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, removed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the push payload
    const payload = JSON.stringify({ title, body, href });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const sub of subscriptions) {
      // Map DB row to the PushSubscription shape web-push expects
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webPush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (err: any) {
        failed++;
        const statusCode = err.statusCode || err.status || 0;

        // 404 / 410 = subscription has expired or been unsubscribed – remove it
        if (statusCode === 404 || statusCode === 410) {
          console.log(
            `Removing stale subscription for user ${userId}: ${sub.endpoint.slice(0, 60)}...`,
          );
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          removed++;
        } else {
          console.error(
            `Push failed for ${sub.endpoint.slice(0, 60)}... (status ${statusCode}):`,
            err.message,
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, removed }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Notify function error:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
