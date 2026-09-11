import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const HARD_WORDS = /\b(kill|murder|rape|bomb|terrorist|slur)\b/i
const SOFT_WORDS = /\b(fuck|shit|damn|ass|bitch)\b/i
const NSFW_WORDS = /\b(nude|naked|sex|porn|explicit)\b/i
const SCAM_PATTERNS = /\b(send money|wire|crypto|paypal|gift card|move to)\b/i

serve(async (req) => {
  try {
    const { text } = await req.json()
    
    const result = {
      safe: true,
      confidence: 0.9,
      flags: [] as string[],
      action: 'allow' as string,
    }

    if (HARD_WORDS.test(text)) {
      result.safe = false
      result.confidence = 0.95
      result.flags.push('hard_content')
      result.action = 'block'
    } else if (SOFT_WORDS.test(text)) {
      result.confidence = 0.7
      result.flags.push('soft_content')
      result.action = 'review'
    } else if (NSFW_WORDS.test(text)) {
      result.flags.push('nsfw')
      result.action = 'review'
    } else if (SCAM_PATTERNS.test(text)) {
      result.flags.push('scam_pattern')
      result.action = 'flag'
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
