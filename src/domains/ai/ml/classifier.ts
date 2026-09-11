import { loadClassifier } from "./bootstrap";

type Intent = "greeting" | "flirting" | "plan" | "safety" | "smalltalk";

const HEUR: { i: Intent; re: RegExp }[] = [
  { i: "safety", re: /\b(send money|wire|crypto|paypal|meet at my house|no one will know|take off the app|dm me on)\b/i },
  { i: "plan", re: /\b(tonight|tomorrow|saturday|sunday|let'?s (meet|grab|do|go)|want to (meet|come|join)|at \d|rooftop|lounge|bar|gym|cafe|beach|dinner|drink)\b/i },
  { i: "greeting", re: /^\s*(hey|hi|hello|yo|sup|good (morning|evening|afternoon))\b/i },
  { i: "flirting", re: /\b(hot|cute|gorgeous|handsome|smell|touch|kiss|bedroom|shower|come over|miss(ed)? you|dream(ing)? of you)\b/i },
];

export function heuristicIntent(text: string): Intent {
  for (const h of HEUR) if (h.re.test(text)) return h.i;
  return /\?$/.test(text.trim()) ? "smalltalk" : "smalltalk";
}

export async function classifyIntent(text: string): Promise<{ intent: Intent; source: "model" | "heuristic" }> {
  try {
    const pipe = await Promise.race([loadClassifier(), new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
    if (pipe) {
      const result = await Promise.race([pipe(text, { multi_label: false }), new Promise<any>((r) => setTimeout(() => r(null), 3000))]);
      if (result?.labels?.length) {
        const labelMap: Record<string, Intent> = { greeting: "greeting", flirting: "flirting", plan: "plan", safety: "safety", smalltalk: "smalltalk" };
        const intent = labelMap[result.labels[0]] ?? "smalltalk";
        return { intent, source: "model" };
      }
    }
  } catch {}
  return { intent: heuristicIntent(text), source: "heuristic" };
}
