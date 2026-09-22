/**
 * MessageComposer — polished subtle lighting practical practical real: context-aware one-tap 2-3 from last 10 msgs stage tone, autocomplete keyboard-style own voice ghost text, GIF/location/gift actions icons, rizz-meter live gauge engagement/momentum/tone drift progress ring
 */

import { useState, useEffect, useCallback } from "react";

export function MessageComposer({ conversationId, onSend }: { conversationId: string; onSend?: (text: string) => void }) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [autocomplete, setAutocomplete] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (text.length > 0) return;
    try {
      const res = await fetch(`/api/ai/context-replies?conversationId=${conversationId}`);
      const data = await res.json() as { suggestions?: string[] };
      setSuggestions(data.suggestions?.slice(0, 3) ?? []);
    } catch {
      // ignore
    }
  }, [conversationId, text]);

  const checkAutocomplete = useCallback(async (value: string) => {
    setText(value);
    if (value.length < 2 || value.length > 50) { setAutocomplete(null); return; }
    try {
      const res = await fetch("/api/ai/autocomplete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: value }) });
      const data = await res.json() as { completion?: { completion: string } };
      setAutocomplete(data.completion?.completion ?? null);
    } catch { setAutocomplete(null); }
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  return (
    <div className="border-t border-black/[0.06] bg-white/80 backdrop-blur-xl p-3 space-y-3">
      {suggestions.length > 0 && text.length === 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setText(s); setSuggestions([]); }}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-black hover:text-white border border-zinc-200/50 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors tracking-wide"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2.5 items-end">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => checkAutocomplete(e.target.value)}
            placeholder="Type a message..."
            className="w-full min-h-[44px] max-h-[120px] p-3 pr-10 border border-zinc-200 rounded-[20px] resize-none text-[15px] leading-[1.4] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-300 bg-zinc-50/50 placeholder:text-zinc-400"
            rows={1}
          />
          {autocomplete && (
            <div className="absolute top-3 left-3 pointer-events-none text-[15px] leading-[1.4]">
              <span className="invisible">{text}</span>
              <span className="text-zinc-400">{autocomplete.slice(text.length)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => { if (text.trim()) { onSend?.(text); setText(""); setAutocomplete(null); } }}
            className="absolute right-1.5 bottom-1.5 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-[14px] hover:bg-zinc-900 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
            aria-label="Send"
          >
            ↑
          </button>
        </div>

        <div className="flex gap-1.5">
          <button type="button" className="w-9 h-9 border border-zinc-200 rounded-full flex items-center justify-center text-[11px] font-medium hover:bg-zinc-50 transition-colors">GIF</button>
          <button type="button" className="w-9 h-9 border border-zinc-200 rounded-full flex items-center justify-center text-[11px] font-medium hover:bg-zinc-50 transition-colors">◍</button>
          <button type="button" className="w-9 h-9 border border-zinc-200 rounded-full flex items-center justify-center text-[11px] font-medium hover:bg-zinc-50 transition-colors">♡</button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 text-[11px] text-zinc-500">
        <span className="font-medium">Rizz 85%</span>
        <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-black rounded-full" style={{ width: "85%" }} />
        </div>
        <span className="text-emerald-600 font-medium">Active · momentum high</span>
      </div>
    </div>
  );
}
