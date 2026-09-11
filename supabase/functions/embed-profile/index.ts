import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { profileId } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch profile data
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', profileId)
      .single()

    if (!profile) throw new Error('Profile not found')

    // Build text representation for embedding
    const text = [
      profile.pseudo,
      profile.description,
      profile.city,
      profile.occupation,
      ...(profile.interests || []),
      ...(profile.tribes || []),
      ...(profile.looking_for || []),
    ].filter(Boolean).join(' ')

    // Simple hash-based embedding (placeholder for real ML)
    const embedding = generateHashEmbedding(text, 384)

    // Store embedding
    await supabase.from('profile_embeddings').upsert({
      profile_id: profileId,
      embedding: JSON.stringify(embedding),
      model: 'hash-v1',
    }, { onConflict: 'profile_id,model' })

    return new Response(
      JSON.stringify({ success: true, dimensions: 384 }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

function generateHashEmbedding(text: string, dimensions: number): number[] {
  const embedding = new Array(dimensions).fill(0)
  const words = text.toLowerCase().split(/\s+/)
  
  for (const word of words) {
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
    }
    const idx = Math.abs(hash) % dimensions
    embedding[idx] += 1
  }
  
  // L2 normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
  return embedding.map(v => v / (norm || 1))
}
