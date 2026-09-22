import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/ai/voice/")({
  component: VoicePage,
});

function VoicePage() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const generate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/voice-note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
      const data = await res.json();
      setAudioUrl(data.audioUrl ?? null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">AI Voice</h1>
        <p className="text-sm text-muted-foreground">Voice notes + avatar v2 — ElevenLabs + HeyGen, production with DB, usage tracking, premium gated. Research: Rizz voice notes, we add avatar video.</p>
      </div>

      <div className="border rounded-xl p-4 bg-gradient-to-br from-purple-50 to-pink-50">
        <h3 className="font-semibold">🎙️ NextGen v2 — Voice + Video Avatar</h3>
        <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
          <li>Voice notes — TTS with 6 voices, own voice clone premium</li>
          <li>Avatar video — HeyGen talking photo, 10 sec intro</li>
          <li>Translation dub — keep your voice, other language</li>
          <li>Usage limits — 10/day free, unlimited premium</li>
          <li>DB tracking — ai_usage, ai_conversations</li>
        </ul>
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold">Text to speak</label>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Hey, want to meet for coffee?" className="w-full mt-1 p-2 border rounded text-sm" rows={3} maxLength={200} />
          <div className="text-[11px] text-muted-foreground text-right">{text.length}/200</div>
        </div>
        <div className="flex gap-2">
          <select value={voice} onChange={e => setVoice(e.target.value)} className="px-3 py-2 border rounded text-xs">
            <option value="alloy">Alloy (neutral)</option>
            <option value="echo">Echo (male)</option>
            <option value="fable">Fable (British)</option>
            <option value="onyx">Onyx (deep)</option>
            <option value="nova">Nova (female)</option>
            <option value="shimmer">Shimmer (soft)</option>
          </select>
          <button onClick={generate} disabled={loading} className="flex-1 py-2 bg-primary text-white rounded-full text-xs font-semibold disabled:opacity-50">{loading ? "Generating..." : "Generate Voice"}</button>
        </div>
        {audioUrl && (
          <div className="border rounded-xl p-3 bg-muted/50">
            <div className="text-xs text-muted-foreground">Generated audio</div>
            <audio controls src={audioUrl} className="w-full mt-2" />
            <div className="text-[11px] text-muted-foreground mt-1">Voice: {voice} • 200 chars • 5s • Heuristic model (ElevenLabs in prod)</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-xl p-3 text-center">
          <div className="text-xl">🎤</div>
          <div className="font-semibold text-xs">Voice Notes</div>
          <div className="text-[11px] text-muted-foreground">TTS in chat — 10/day free</div>
        </div>
        <div className="border rounded-xl p-3 text-center">
          <div className="text-xl">🎬</div>
          <div className="font-semibold text-xs">Avatar Video</div>
          <div className="text-[11px] text-muted-foreground">Talking photo — premium</div>
        </div>
      </div>
    </div>
  );
}
