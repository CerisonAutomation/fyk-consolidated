/**
 * MessageComposer — Canonical composer with AI suggestions, autocomplete
 * Replaces AIComposer (divine naming)
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
      const data = await res.json();
      setSuggestions(data.suggestions?.slice(0, 3) ?? []);
    } catch {
      // ignore
    }
  }, [conversationId, text]);

  const checkAutocomplete = useCallback(async (value: string) => {
    setText(value);
    if (value.length < 2 || value.length > 50) {
      setAutocomplete(null);
      return;
    }
    try {
      const res = await fetch("/api/ai/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: value }),
      });
      const data = await res.json();
      setAutocomplete(data.completion?.completion ?? null);
    } catch {
      setAutocomplete(null);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return (
    <div className="border-t bg-background p-2 space-y-2">
      {suggestions.length > 0 && text.length === 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setText(s);
                setSuggestions([]);
              }}
              className="px-3 py-1.5 bg-muted rounded-full text-xs whitespace-nowrap hover:bg-primary hover:text-white transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => checkAutocomplete(e.target.value)}
            placeholder="Type a message..."
            className="w-full min-h-[40px] max-h-[120px] p-2 pr-8 border rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            rows={1}
          />
          {autocomplete && (
            <div className="absolute top-2 left-2 pointer-events-none text-sm">
              <span className="invisible">{text}</span>
              <span className="text-muted-foreground">{autocomplete.slice(text.length)}</span>
            </div>
          )}
          <button
            onClick={() => {
              if (text.trim()) {
                onSend?.(text);
                setText("");
                setAutocomplete(null);
              }
            }}
            className="absolute right-1 bottom-1 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs"
          >
            ↑
          </button>
        </div>

        <div className="flex gap-1">
          <button className="w-8 h-8 border rounded-full flex items-center justify-center text-xs">GIF</button>
          <button className="w-8 h-8 border rounded-full flex items-center justify-center text-xs">LOC</button>
          <button className="w-8 h-8 border rounded-full flex items-center justify-center text-xs">GIFT</button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Score: 85%</span>
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: "85%" }} />
        </div>
        <span className="text-green-500">Active</span>
      </div>
    </div>
  );
}
