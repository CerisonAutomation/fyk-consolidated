import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCompatibility } from "#/hooks/app-hooks";

export const Route = createFileRoute("/discover/compatibility/")({
  component: CompatibilityPage,
});

type Score = { id: string; userB?: string; score: number; dimensions?: Record<string, number> };

function CompatibilityPage() {
  const compat = useCompatibility();
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discover/compatibility").then(r => r.json()).then(d => { setScores((d.scores ?? []) as Score[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4"><div className="animate-pulse h-20 bg-muted rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Compatibility</h1>
        <p className="text-sm text-muted-foreground">Compatibility scoring across 5 dimensions with explainable reasons. Uses useCompatibility hook. Scores: {compat.scores.length} in store.</p>
      </div>

      <div className="border rounded-xl p-4">
        <h3 className="font-semibold">How Scoring Works</h3>
        <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
          <li><b>Interests:</b> tagOverlap Jaccard — shared interests divided by union</li>
          <li><b>Lifestyle:</b> lookingFor and intents alignment</li>
          <li><b>Communication:</b> reply rate and best time overlap</li>
          <li><b>Values:</b> tribes, relationship status, tolerance</li>
          <li><b>Activity:</b> online overlap, distance, recency</li>
          <li>Score 0-100, explainable via /api/ai/match-reasons</li>
        </ul>
      </div>

      <div className="space-y-2">
        {scores.slice(0, 10).map((s) => (
          <div key={s.id} className="border rounded-xl p-3">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-sm">{s.userB ?? "User"} — {s.score}% compatible</div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${s.score >= 80 ? "bg-green-500 text-white" : s.score >= 60 ? "bg-yellow-500 text-white" : "bg-muted"}`}>{s.score >= 80 ? "Soulmate" : s.score >= 60 ? "Good" : "Okay"}</span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1 text-[10px]">
              {Object.entries(s.dimensions ?? {}).map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${v as number}%` }} /></div>
                  <div className="mt-1 text-muted-foreground">{k}</div>
                  <div className="font-semibold">{v as number}%</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {scores.length === 0 && (
          <div className="border rounded-xl p-8 text-center">
            <div className="font-semibold text-sm">No compatibility scores yet</div>
            <div className="text-xs text-muted-foreground">Like profiles to generate scores — calculates 5 dimensions</div>
          </div>
        )}
      </div>
    </div>
  );
}
