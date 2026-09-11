import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, conversationId } = await req.json()
    
    // Get auth
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Multi-provider AI
    const providers = [
      { key: 'ANTHROPIC_API_KEY', name: 'anthropic' },
      { key: 'OPENAI_API_KEY', name: 'openai' },
      { key: 'GEMINI_API_KEY', name: 'gemini' },
    ]
    
    let response = ''
    let usedProvider = 'fallback'
    
    for (const p of providers) {
      const apiKey = Deno.env.get(p.key)
      if (!apiKey) continue
      
      try {
        if (p.name === 'anthropic') {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1024,
              messages: [{ role: 'user', content: message }],
            }),
          })
          const data = await res.json()
          response = data.content?.[0]?.text || ''
        } else if (p.name === 'openai') {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: message }],
              max_tokens: 1024,
            }),
          })
          const data = await res.json()
          response = data.choices?.[0]?.message?.content || ''
        }
        
        if (response) {
          usedProvider = p.name
          break
        }
      } catch (e) {
        console.error(`${p.name} failed:`, e)
        continue
      }
    }

    // Fallback to heuristic if no provider worked
    if (!response) {
      response = generateHeuristicReply(message)
      usedProvider = 'heuristic'
    }

    // Store in database
    if (conversationId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        type: 'text',
        content: response,
      })
    }

    return new Response(
      JSON.stringify({ response, provider: usedProvider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateHeuristicReply(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('?')) return "That's a great question! Tell me more."
  if (lower.match(/\b(hi|hey|hello)\b/)) return "Hey there! How's your day going?"
  if (lower.match(/\b(date|meet|hangout)\b/)) return "I'd love to meet up! When works for you?"
  if (lower.match(/\b(thanks|thank you)\b/)) return "You're welcome! 😊"
  return "That's interesting! Tell me more about that."
}
