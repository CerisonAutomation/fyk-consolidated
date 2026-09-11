import { loadGenerator } from "./bootstrap";
import { heuristicIntent } from "./classifier";

const SMART_BANK: Record<string, string[]> = {
  plan: ["That works for me", "Saturday works — send the pin 📍", "I'm free after 9", "Let's lock it in then"],
  flirting: ["Same energy 😏", "You always know what to say", "Careful, I might blush", "Smooth. I respect it 😄"],
  greeting: ["Hey hey 👋", "Hey! How's your week going?", "Yo — missed seeing you here"],
  smalltalk: ["Haha exactly", "Tell me more", "That's a good take", "I was literally just thinking that"],
  safety: ["Let's keep things here for now", "Can we do the first meet on-app?", "I'd rather keep it casual first"],
};

export async function generateReply(lastText: string, fromName: string): Promise<{ text: string; source: "model" | "heuristic" }> {
  const prompt = `Reply to this message from ${fromName}: "${lastText}". Tone: warm, direct, a little playful. Max 12 words. Do not repeat the question.`;
  try {
    const pipe = await Promise.race([loadGenerator(), new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
    if (pipe) {
      const result = await Promise.race([pipe(prompt, { max_new_tokens: 42, do_sample: false }), new Promise<any>((r) => setTimeout(() => r(null), 5000))]);
      const raw = result?.[0]?.generated_text ?? "";
      const t = raw.replace(/\s+/g, " ").trim();
      if (t && t.length > 2 && !t.toLowerCase().includes(prompt.slice(0, 24).toLowerCase())) {
        return { text: t.slice(0, 140), source: "model" };
      }
    }
  } catch {}
  const intent = heuristicIntent(lastText);
  const bank = SMART_BANK[intent] ?? SMART_BANK.smalltalk;
  return { text: bank[Math.floor(Math.random() * bank.length)], source: "heuristic" };
}

const TONE_OPEN: Record<string, string> = { confident: "No small talk. ", warm: "Honestly, ", witty: "Plot twist: ", direct: "Straight up: " };
const CTA = ["Say hi if you get it.", "Your move.", "If that's you, I know where to find you."];

export async function rewriteBio(bio: string, tone: string): Promise<{ text: string; source: "model" | "heuristic" }> {
  const prompt = `Rewrite this dating bio in a ${tone} voice. Keep it under 35 words, first person, no hashtags: "${bio}"`;
  try {
    const pipe = await Promise.race([loadGenerator(), new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
    if (pipe) {
      const result = await Promise.race([pipe(prompt, { max_new_tokens: 48 }), new Promise<any>((r) => setTimeout(() => r(null), 5000))]);
      const t = (result?.[0]?.generated_text ?? "").replace(/\s+/g, " ").trim();
      if (t && t.length > 8 && !t.toLowerCase().includes(prompt.slice(0, 24).toLowerCase())) {
        return { text: t.slice(0, 280), source: "model" };
      }
    }
  } catch {}
  const cap = bio.replace(/\s+/g, " ").trim().slice(0, 110);
  return { text: `${TONE_OPEN[tone] ?? ""}${cap.charAt(0).toLowerCase() + cap.slice(1)}. ${CTA[Math.floor(Math.random() * CTA.length)]}`.slice(0, 140), source: "heuristic" };
}
