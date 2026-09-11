import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// CORS headers — shared across all responses
// ---------------------------------------------------------------------------
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------------------
// 1.  STARTUP ENVIRONMENT VALIDATION
//     Runs once when the isolate boots. Logs missing keys so operators can
//     see them in Supabase Edge Function logs without digging through code.
// ---------------------------------------------------------------------------
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const OPENAI_KEY    = Deno.env.get('OPENAI_API_KEY') ?? ''
const GEMINI_KEY    = Deno.env.get('GEMINI_API_KEY') ?? ''

const availableProviders: { key: string; name: string }[] = []
if (ANTHROPIC_KEY) availableProviders.push({ key: ANTHROPIC_KEY, name: 'anthropic' })
if (OPENAI_KEY)    availableProviders.push({ key: OPENAI_KEY,    name: 'openai' })
if (GEMINI_KEY)    availableProviders.push({ key: GEMINI_KEY,    name: 'gemini' })

if (availableProviders.length === 0) {
  console.error(
    '[ai-chat] CRITICAL: No AI provider API keys found in environment. ' +
    'Set at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY. ' +
    'The function will fall back to heuristic responses.'
  )
}

console.log(
  `[ai-chat] Boot — ${availableProviders.length} AI provider(s) available: ` +
  (availableProviders.map(p => p.name).join(', ') || 'none')
)

// ---------------------------------------------------------------------------
// 2.  IN-MEMORY RATE LIMITER
//     Best-effort per-isolate protection. Edge function isolates can be
//     recycled, so this is burst protection, not a hard guarantee. For
//     strict enforcement a database-backed check would be needed.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX    = 30          // messages per window
const RATE_LIMIT_WINDOW = 60 * 60_000 // 1 hour in ms

interface RateEntry { count: number; windowStart: number }
const rateLimitMap = new Map<string, RateEntry>()

function isRateLimited(userId: string): boolean {
  const now  = Date.now()
  const prev = rateLimitMap.get(userId)

  if (!prev || now - prev.windowStart > RATE_LIMIT_WINDOW) {
    // Start a fresh window
    rateLimitMap.set(userId, { count: 1, windowStart: now })
    return false
  }

  prev.count++
  return prev.count > RATE_LIMIT_MAX
}

function remainingMessages(userId: string): number {
  const entry = rateLimitMap.get(userId)
  if (!entry || Date.now() - entry.windowStart > RATE_LIMIT_WINDOW) {
    return RATE_LIMIT_MAX
  }
  return Math.max(0, RATE_LIMIT_MAX - entry.count)
}

// Periodic cleanup every 10 min so the map doesn't grow unbounded
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW
  for (const [key, val] of rateLimitMap) {
    if (val.windowStart < cutoff) rateLimitMap.delete(key)
  }
}, 10 * 60_000)

// ---------------------------------------------------------------------------
// 3.  REQUEST BODY VALIDATION
// ---------------------------------------------------------------------------
interface ChatRequest {
  message: string
  conversationId?: string
}

function validateBody(body: unknown): { ok: true; data: ChatRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }

  const { message, conversationId } = body as Record<string, unknown>

  if (typeof message !== 'string') {
    return { ok: false, error: '"message" is required and must be a non-empty string.' }
  }

  const trimmed = message.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: '"message" must not be empty.' }
  }

  if (trimmed.length > 4000) {
    return { ok: false, error: '"message" must be 4000 characters or fewer.' }
  }

  if (conversationId !== undefined && conversationId !== null) {
    if (typeof conversationId !== 'string') {
      return { ok: false, error: '"conversationId" must be a UUID string if provided.' }
    }
    // Basic UUID shape check
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
      return { ok: false, error: '"conversationId" is not a valid UUID.' }
    }
  }

  return { ok: true, data: { message: trimmed, conversationId: conversationId ?? undefined } }
}

// ---------------------------------------------------------------------------
// 4.  HEURISTIC FALLBACK RESPONDER
//     Used when every AI provider is unavailable or has failed.
// ---------------------------------------------------------------------------
function generateHeuristicReply(message: string): string {
  const lower = message.toLowerCase()

  // Greeting
  if (lower.match(/\b(hi|hey|hello|yo|sup|howdy)\b/)) {
    return "Hey! Great to hear from you. What's on your mind?"
  }
  // Question
  if (lower.includes('?')) {
    return "That's a really thoughtful question. I'd love to dig into that — tell me more about what you're looking for."
  }
  // Date / meetup
  if (lower.match(/\b(date|meet|hangout|coffee|dinner|plans)\b/)) {
    return "I'd love to make plans! What did you have in mind?"
  }
  // Gratitude
  if (lower.match(/\b(thanks?|thank you|thx|appreciate)\b/)) {
    return "Of course! Happy to help."
  }
  // Compliment / affection
  if (lower.match(/\b(love|cute|beautiful|amazing|awesome)\b/)) {
    return "That's so kind of you! You just made my day."
  }
  // Sentiment (sad, stressed, etc.)
  if (lower.match(/\b(sad|stressed|tired|down|upset|anxious|worried)\b/)) {
    return "I'm sorry you're feeling that way. I'm here if you want to talk about it."
  }
  // Default
  return "That's interesting — tell me more about it!"
}

// ---------------------------------------------------------------------------
// 5.  PROVIDER CALL HELPERS
//     Each returns the text content on success, or throws a descriptive
//     error. The caller decides whether to try the next provider.
// ---------------------------------------------------------------------------

async function callAnthropic(
  apiKey: string,
  messages: { role: string; content: string }[],
  maxTokens = 1024,
): Promise<string> {
  // Anthropic requires system prompt as a separate parameter, not in messages
  const systemMsg = messages.find(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  const payload: Record<string, unknown> = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: maxTokens,
    messages: nonSystem,
  }
  if (systemMsg) payload.system = systemMsg.content

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(could not read body)')
    throw new Error(`Anthropic HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text
  if (!text) throw new Error('Anthropic returned empty content')
  return text
}

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  maxTokens = 1024,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(could not read body)')
    throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI returned empty content')
  return text
}

async function callGemini(
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  // Convert to Gemini format: system + user messages
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '(could not read body)')
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty content')
  return text
}

// ---------------------------------------------------------------------------
// 6.  PROVIDER DISPATCHER
//     Tries each available provider in order, catches errors, and falls
//     back through the chain. Returns the text + provider name.
// ---------------------------------------------------------------------------
async function callAIProvider(
  messages: { role: string; content: string }[],
): Promise<{ text: string; provider: string }> {
  for (const p of availableProviders) {
    try {
      let text: string

      switch (p.name) {
        case 'anthropic':
          text = await callAnthropic(p.key, messages)
          break
        case 'openai':
          text = await callOpenAI(p.key, messages)
          break
        case 'gemini':
          text = await callGemini(p.key, messages)
          break
        default:
          continue
      }

      return { text, provider: p.name }
    } catch (err) {
      console.error(`[ai-chat] ${p.name} failed:`, err.message ?? err)
      // Continue to the next provider
    }
  }

  return { text: '', provider: '' }
}

// ---------------------------------------------------------------------------
// 7.  CONVERSATION HISTORY HELPER
//     Fetches the last N messages so the AI gets conversational context.
// ---------------------------------------------------------------------------
const HISTORY_LIMIT = 10

async function fetchConversationHistory(
  supabase: SupabaseClient,
  conversationId: string,
  currentUserId: string,
): Promise<{ role: string; content: string }[]> {
  const { data: rows, error } = await supabase
    .from('messages')
    .select('sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) {
    console.error('[ai-chat] Failed to fetch conversation history:', error.message)
    return []
  }

  if (!rows || rows.length === 0) return []

  // Reverse so oldest-first (chronological order for the API)
  return rows
    .reverse()
    .filter((r: any) => r.body)
    .map((r: any) => ({
      role: r.sender_id === currentUserId ? 'user' : 'assistant',
      content: r.body as string,
    }))
}

// ---------------------------------------------------------------------------
// 8.  MAIN HANDLER
// ---------------------------------------------------------------------------
serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only POST is allowed
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // --- Rate limit ---
    if (isRateLimited(user.id)) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded. You can send up to 30 messages per hour.',
          retryAfterSeconds: RATE_LIMIT_WINDOW / 1000,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(RATE_LIMIT_WINDOW / 1000),
          },
        },
      )
    }

    // --- Validate body ---
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const validation = validateBody(body)
    if (!validation.ok) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { message, conversationId } = validation.data

    // --- Fetch conversation history for context ---
    const history = conversationId
      ? await fetchConversationHistory(supabase, conversationId, user.id)
      : []

    // Build the messages array: history + current user message
    const apiMessages = [
      {
        role: 'system',
        content:
          'You are a warm, friendly AI assistant inside a social app. ' +
          'Keep replies concise, natural, and conversational. ' +
          'Never reveal that you are an AI unless asked directly.',
      },
      ...history,
      { role: 'user', content: message },
    ]

    // --- Call AI providers with fallback ---
    let response: string
    let provider: string

    if (availableProviders.length === 0) {
      // No API keys at all — go straight to heuristic
      response = generateHeuristicReply(message)
      provider = 'heuristic'
    } else {
      const result = await callAIProvider(apiMessages)
      if (result.text) {
        response = result.text
        provider = result.provider
      } else {
        // All providers failed
        console.error('[ai-chat] All AI providers failed — falling back to heuristic')
        response = generateHeuristicReply(message)
        provider = 'heuristic'
      }
    }

    // --- Store AI response in the conversation ---
    if (conversationId) {
      const { error: insertError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        type: 'text',
        body: response,
      })
      if (insertError) {
        // Log but don't fail the request — the user already has the response
        console.error('[ai-chat] Failed to store AI response:', insertError.message)
      }
    }

    // --- Build response ---
    const responseData: Record<string, unknown> = {
      response,
      provider,
      remainingMessages: remainingMessages(user.id),
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('[ai-chat] Unhandled error:', error)

    const message =
      error instanceof Error ? error.message : 'Internal server error'

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
