/**
 * generator.ts
 * Text generation using Transformers.js text2text-generation pipeline.
 *
 * Production patterns per docs:
 *  - Text2Text generation (T5 architecture) for reply suggestions and bio rewrites
 *  - max_new_tokens to control output length
 *  - do_sample: false for deterministic output
 *  - Timeout-based fallback to heuristic text banks
 *  - Proper error categorization for ML operations
 */

import { loadGenerator as loadMLGenerator, type MLError } from "./bootstrap";
import { heuristicIntent } from "./classifier";
import { raceTimeout } from "./race-timeout";

// ---------------------------------------------------------------------------
// Heuristic text banks (unchanged)
// ---------------------------------------------------------------------------

const SMART_BANK: Record<string, string[]> = {
  plan: ["That works for me", "Saturday works -- send the pin", "I'm free after 9", "Let's lock it in then"],
  flirting: ["Same energy", "You always know what to say", "Careful, I might blush", "Smooth. I respect it"],
  greeting: ["Hey hey", "Hey! How's your week going?", "Yo -- missed seeing you here"],
  smalltalk: ["Haha exactly", "Tell me more", "That's a good take", "I was literally just thinking that"],
  safety: ["Let's keep things here for now", "Can we do the first meet on-app?", "I'd rather keep it casual first"],
};

// ---------------------------------------------------------------------------
// ML-based reply generation
// ---------------------------------------------------------------------------

/**
 * Generate a reply using ML model with heuristic fallback.
 *
 * Per docs: uses text2text-generation with max_new_tokens to control
 * output length. Falls back to curated text banks when model
 * unavailable or output quality is poor.
 */
export async function generateReply(
  lastText: string,
  fromName: string,
): Promise<{ text: string; source: "model" | "heuristic" }> {
  if (!lastText || lastText.trim().length === 0) {
    return { text: SMART_BANK.smalltalk[0], source: "heuristic" };
  }

  const prompt = `Reply to this message from ${fromName}: "${lastText}". Tone: warm, direct, a little playful. Max 12 words. Do not repeat the question.`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipe: any = await raceTimeout(loadMLGenerator(), 5_000, () => null);

    if (pipe) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await raceTimeout(
        pipe(prompt, { max_new_tokens: 42, do_sample: false }),
        5_000,
        () => null,
      );

      const raw = result?.[0]?.generated_text ?? "";
      const t = raw.replace(/\s+/g, " ").trim();

      // Quality gate: reject if output is too short or echoes the prompt
      if (t && t.length > 2 && !t.toLowerCase().includes(prompt.slice(0, 24).toLowerCase())) {
        return { text: t.slice(0, 140), source: "model" };
      }
    }
  } catch (err) {
    const mlErr = err as MLError;
    if (mlErr.code === "TIMEOUT") {
      console.debug("[generator] Model load timeout, using heuristic");
    } else if (mlErr.code === "MODEL_LOAD_FAILED") {
      console.warn("[generator] Model load failed:", mlErr.message);
    } else {
      console.debug("[generator] Generation error:", mlErr.message ?? err);
    }
  }

  const intent = heuristicIntent(lastText);
  const bank = SMART_BANK[intent] ?? SMART_BANK.smalltalk;
  return { text: bank[Math.floor(Math.random() * bank.length)], source: "heuristic" };
}

// ---------------------------------------------------------------------------
// ML-based bio rewrite
// ---------------------------------------------------------------------------

const TONE_OPEN: Record<string, string> = {
  confident: "No small talk. ",
  warm: "Honestly, ",
  witty: "Plot twist: ",
  direct: "Straight up: ",
};
const CTA = ["Say hi if you get it.", "Your move.", "If that's you, I know where to find you."];

/**
 * Rewrite a bio using ML model with heuristic fallback.
 *
 * Per docs: uses text2text-generation with tone-specific prompting.
 * Falls back to heuristic tone transformation when model unavailable.
 */
export async function rewriteBio(
  bio: string,
  tone: string,
): Promise<{ text: string; source: "model" | "heuristic" }> {
  if (!bio || bio.trim().length === 0) {
    return { text: `${TONE_OPEN[tone] ?? ""}New here. ${CTA[0]}`.slice(0, 140), source: "heuristic" };
  }

  const prompt = `Rewrite this dating bio in a ${tone} voice. Keep it under 35 words, first person, no hashtags: "${bio}"`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipe: any = await raceTimeout(loadMLGenerator(), 5_000, () => null);

    if (pipe) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await raceTimeout(
        pipe(prompt, { max_new_tokens: 48 }),
        5_000,
        () => null,
      );

      const t = (result?.[0]?.generated_text ?? "").replace(/\s+/g, " ").trim();

      if (t && t.length > 8 && !t.toLowerCase().includes(prompt.slice(0, 24).toLowerCase())) {
        return { text: t.slice(0, 280), source: "model" };
      }
    }
  } catch (err) {
    const mlErr = err as MLError;
    if (mlErr.code === "TIMEOUT") {
      console.debug("[generator] Model load timeout, using heuristic");
    } else if (mlErr.code === "MODEL_LOAD_FAILED") {
      console.warn("[generator] Model load failed:", mlErr.message);
    } else {
      console.debug("[generator] Generation error:", mlErr.message ?? err);
    }
  }

  const cap = bio.replace(/\s+/g, " ").trim().slice(0, 110);
  return {
    text: `${TONE_OPEN[tone] ?? ""}${cap.charAt(0).toLowerCase() + cap.slice(1)}. ${CTA[Math.floor(Math.random() * CTA.length)]}`.slice(0, 140),
    source: "heuristic",
  };
}
