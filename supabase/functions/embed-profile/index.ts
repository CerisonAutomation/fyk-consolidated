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

// ---------------------------------------------------------------------------
// Real ML embedding pipeline -- cached across warm invocations.
//
// On cold start the ONNX model (~23 MB quantised) is downloaded from Hugging
// Face Hub and loaded into the WASM runtime once.  Subsequent requests within
// the same isolate reuse the cached pipeline with zero overhead.
//
// Model: Xenova/all-MiniLM-L6-v2  --  384-dimensional sentence embeddings
// Backend: ONNX Runtime Web (WASM) via @huggingface/transformers
// ---------------------------------------------------------------------------

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIMS = 384;
const MAX_INPUT_CHARS = 2048; // keeps token count within the model's 512-token window

let extractorPromise: Promise<any> | null = null;

async function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      console.log(`[embed-profile] loading model ${MODEL_ID} ...`);
      const { pipeline } = await import(
        "https://esm.sh/@huggingface/transformers@3.4.0"
      );
      // In v3 the library loads quantised ONNX models by default from
      // Hugging Face Hub -- no `quantized` option needed.
      const pipe = await pipeline("feature-extraction", MODEL_ID);
      console.log("[embed-profile] model ready");
      return pipe;
    })();
  }
  return extractorPromise;
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  // Handle CORS preflight (per docs: always handle OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { profileId } = await req.json();

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "profileId is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use service_role for this background task (it reads all profiles)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch profile data
    const { data: profile, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", profileId)
      .single();

    if (fetchError) throw new Error(`Profile query failed: ${fetchError.message}`);
    if (!profile) throw new Error("Profile not found");

    // Build a rich text representation from all available profile fields
    const text = [
      profile.pseudo,
      profile.description,
      profile.city,
      profile.occupation,
      ...(profile.interests || []),
      ...(profile.tribes || []),
      ...(profile.looking_for || []),
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, MAX_INPUT_CHARS);

    if (!text.trim()) {
      throw new Error("Profile has no text content to embed");
    }

    // --- Generate real semantic embedding ----------------------------------
    const extractor = await getExtractor();

    const output = await extractor(text, {
      pooling: "mean", // mean-pool across token embeddings
      normalize: true, // L2-normalise so cosine similarity == dot product
    });

    // output.data is a Float32Array -- convert to plain number[] for JSON
    const embedding: number[] = Array.from(
      (output as any).data.slice(0, EMBEDDING_DIMS),
    ) as number[];

    if (embedding.length !== EMBEDDING_DIMS) {
      throw new Error(
        `Unexpected embedding dimensions: expected ${EMBEDDING_DIMS}, got ${embedding.length}`,
      );
    }

    // --- Persist to profile_embeddings table ------------------------------
    const { error: upsertError } = await supabase
      .from("profile_embeddings")
      .upsert(
        {
          profile_id: profileId,
          embedding: JSON.stringify(embedding),
          model: MODEL_ID,
        },
        { onConflict: "profile_id,model" },
      );

    if (upsertError) {
      throw new Error(`Failed to store embedding: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dimensions: embedding.length,
        model: MODEL_ID,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[embed-profile]", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
