import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/matches/compatibility/")({
  component: CompatPage,
});

function CompatPage() {
  const [targetId, setTargetId] = useState("");
  const [score, setScore] = useState<any>(null);

  const calculate = async () => {
    if (!targetId) return;
    const res = await fetch("/api/matches/compatibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId }) });
    const data = await res.json();
    setScore(data.score);
  };

  const discover = async () => {
    const res = await fetch("/api/discover/compatibility?minScore=70&limit=10");
    const data = await res.json();
    setScore({ candidates: data.candidates });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Compatibility Score (15.4)</h1>
      <p className="text-sm text-muted-foreground">Match % from overlapping tags, shown on card, ranks grid — 0.3 vibe + 0.25 intimacy + 0.25 logistics + 0.2 lifestyle</p>
      <div className="flex gap-2">
        <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Target UUID" className="flex-1 border rounded p-2 text-sm" />
        <button onClick={calculate} className="px-3 py-1 bg-primary text-white rounded text-sm">Calculate</button>
        <button onClick={discover} className="px-3 py-1 border rounded text-sm">Discover High Compat</button>
      </div>
      {score && (
        <div className="border rounded-xl p-4 text-sm space-y-2">
          {score.score !== undefined ? (
            <>
              <div className="text-2xl font-bold">{score.score}% compatible</div>
              <div>Vibe: {Math.round((score.dimensions?.vibe ?? 0)*100)}% | Intimacy: {Math.round((score.dimensions?.intimacy ?? 0)*100)}% | Logistics: {Math.round((score.dimensions?.logistics ?? 0)*100)}% | Lifestyle: {Math.round((score.dimensions?.lifestyle ?? 0)*100)}%</div>
            </>
          ) : score.candidates ? (
            <div className="space-y-2">
              {score.candidates.map((c: any) => <div key={c.user.id} className="border rounded p-2 flex justify-between"><span>{c.user.displayName ?? c.user.id.slice(0,8)} — {c.score}%</span><span className="text-xs">{Object.entries(c.dimensions).map(([k,v]) => `${k}:${Math.round((v as number)*100)}%`).join(" ")}</span></div>)}
            </div>
          ) : <pre className="text-xs">{JSON.stringify(score, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}
