/**
 * AIAssistantPanel — Canonical AI features, professional naming
 * Wires: usePhotoScores, useAI
 */

import { useState } from "react";
import { usePhotoScores, useAI } from "@/hooks/app-hooks";

export function PhotoEnhancerPanel() {
  const { scorePhoto, topPhotos, averageAppeal } = usePhotoScores();
  const [url, setUrl] = useState("");
  const [scores, setScores] = useState<Array<{ quality: number; lighting: number; blur: number; smile: number; appeal: number; suggestions?: string[] }>>([]);

  const handleScore = async () => {
    if (!url) return;
    const score = await scorePhoto(url);
    setScores((s) => [...s, score as never]);
  };

  return (
    <div className="p-4 border rounded-xl space-y-3">
      <h3 className="font-semibold">Photo Enhancer and Ordering</h3>
      <p className="text-xs text-muted-foreground">Scores quality and appeal. Blocks identity changes. Uses usePhotoScores. Top {topPhotos.length} avg {Math.round(averageAppeal)}.</p>
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Photo URL" className="flex-1 border rounded p-2 text-sm" />
        <button type="button" onClick={handleScore} className="px-3 py-1 bg-primary text-white rounded text-sm">Score</button>
      </div>
      {scores.map((s, i) => (
        <div key={i} className="text-xs border rounded p-2">
          <div>Quality: {s.quality} | Lighting: {s.lighting} | Blur: {s.blur} | Smile: {s.smile} | Appeal: {s.appeal}</div>
          <div className="text-muted-foreground">{s.suggestions?.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}

export function TranslationPanel() {
  const ai = useAI();
  const [text, setText] = useState("");
  const [targetLang, setTargetLang] = useState("es");
  const [result, setResult] = useState<{ translated: string; sourceLang: string; targetLang: string; model: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const translate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
      });
      const data = await res.json() as { result: typeof result };
      setResult(data.result);
      await ai.generate("translation", { text, targetLang, result: data.result });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-xl space-y-3">
      <h3 className="font-semibold">Real-Time Translation</h3>
      <p className="text-xs text-muted-foreground">Inline per bubble, auto source detection. Uses useAI for tracking. Usage: {ai.getUsage("translation")}.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to translate" className="w-full border rounded p-2 text-sm" rows={2} />
      <div className="flex gap-2">
        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="border rounded p-1 text-sm">
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese</option>
        </select>
        <button type="button" onClick={translate} disabled={loading} className="px-3 py-1 bg-primary text-white rounded text-sm">
          {loading ? "..." : "Translate"}
        </button>
      </div>
      {result && (
        <div className="text-sm p-2 bg-muted rounded">
          {result.translated} <span className="text-xs text-muted-foreground">({result.sourceLang} to {result.targetLang} via {result.model})</span>
        </div>
      )}
    </div>
  );
}

export function AutocompleteDemo() {
  const ai = useAI();
  const [prefix, setPrefix] = useState("");
  const [completion, setCompletion] = useState<{ completion: string; source: string; confidence: number } | null>(null);

  const check = async (value: string) => {
    setPrefix(value);
    if (value.length < 2) {
      setCompletion(null);
      return;
    }
    const res = await fetch("/api/ai/autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: value }),
    });
    const data = await res.json() as { completion: typeof completion };
    setCompletion(data.completion);
    if (data.completion) ai.generate("autocomplete", { prefix: value, completion: data.completion });
  };

  return (
    <div className="p-4 border rounded-xl space-y-2">
      <h3 className="font-semibold">Conversation Autocomplete</h3>
      <p className="text-xs text-muted-foreground">Predicts rest of sentence in your voice. Uses useAI. Generating: {String(ai.generating)}</p>
      <div className="relative">
        <input value={prefix} onChange={(e) => check(e.target.value)} placeholder="Type hey, how are, what are..." className="w-full border rounded p-2 text-sm" />
        {completion && (
          <div className="absolute top-full left-0 right-0 bg-white border rounded mt-1 p-2 text-sm shadow-lg">
            <span className="text-muted-foreground">{prefix}</span>
            <span className="text-primary font-medium">{completion.completion.slice(prefix.length)}</span>
            <div className="text-xs text-muted-foreground">Source: {completion.source} ({Math.round(completion.confidence * 100)}%)</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MemeSuggestPanel() {
  const ai = useAI();
  const [message, setMessage] = useState("");
  const [memes, setMemes] = useState<Array<{ id: string; url: string; tags: string[] }>>([]);

  const suggest = async () => {
    const res = await fetch("/api/ai/meme-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json() as { memes: typeof memes };
    setMemes(data.memes);
    ai.generate("meme", { message, count: data.memes.length });
  };

  return (
    <div className="p-4 border rounded-xl space-y-2">
      <h3 className="font-semibold">Meme and GIF Suggestion</h3>
      <p className="text-xs text-muted-foreground">Filters semantically from current message. Uses useAI.</p>
      <div className="flex gap-2">
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Current message..." className="flex-1 border rounded p-2 text-sm" />
        <button type="button" onClick={suggest} className="px-3 py-1 bg-primary text-white rounded text-sm">Suggest</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {memes.map((m) => (
          <div key={m.id} className="border rounded p-1 text-xs">
            <div className="truncate">{m.url}</div>
            <div className="text-muted-foreground">{m.tags.join(", ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VoiceNotePanel() {
  const ai = useAI();
  const [text, setText] = useState("");
  const [tone, setTone] = useState("warm");
  const [voiceNote, setVoiceNote] = useState<{ durationSec: number; tone: string; transcript: string } | null>(null);

  const generate = async () => {
    const res = await fetch("/api/ai/voice-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone }),
    });
    const data = await res.json() as { voiceNote: typeof voiceNote };
    setVoiceNote(data.voiceNote);
    ai.generate("voice-note", { text, tone, duration: data.voiceNote?.durationSec });
  };

  return (
    <div className="p-4 border rounded-xl space-y-2">
      <h3 className="font-semibold">Voice Note Reply</h3>
      <p className="text-xs text-muted-foreground">Generate warm voice note in your tone. Uses useAI. Conversations: {ai.conversations.length}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Text for voice note" className="w-full border rounded p-2 text-sm" rows={2} />
      <div className="flex gap-2">
        <select value={tone} onChange={(e) => setTone(e.target.value)} className="border rounded p-1 text-sm">
          <option value="warm">Warm</option>
          <option value="casual">Casual</option>
          <option value="flirty">Flirty</option>
          <option value="friendly">Friendly</option>
        </select>
        <button type="button" onClick={generate} className="px-3 py-1 bg-primary text-white rounded text-sm">Generate</button>
      </div>
      {voiceNote && (
        <div className="text-xs p-2 bg-muted rounded">Duration: {voiceNote.durationSec}s | Tone: {voiceNote.tone} | Transcript: {voiceNote.transcript}</div>
      )}
    </div>
  );
}

export function AIAssistantPanel() {
  const ai = useAI();
  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">AI usage: {Object.entries(ai.usage).map(([k, v]) => `${k}:${v}`).join(", ") || "none"} | Can use: {String(ai.canUseFeature("translation", 100))}</div>
      <PhotoEnhancerPanel />
      <TranslationPanel />
      <AutocompleteDemo />
      <MemeSuggestPanel />
      <VoiceNotePanel />
    </div>
  );
}
