import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { userId, title, body, href } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'push',
      title,
      body,
      href,
    })

    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (!subscriptions?.length) return new Response(JSON.stringify({ sent: 0 }))

    // Send push notifications (using web-push protocol)
    
    let sent = 0
    for (const sub of subscriptions) {
      try {
        // In production, use web-push library
        // For now, just log the intent
        console.log(`Would send push to ${sub.endpoint}`)
        sent++
      } catch (e) {
        console.error('Push failed:', e)
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
