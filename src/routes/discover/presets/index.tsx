import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/discover/presets/")({
  component: PresetsPage,
});

function PresetsPage() {
  const [presets, setPresets] = useState<any[]>([]);
  const [quick, setQuick] = useState<any[]>([]);

  const fetchPresets = async () => {
    const res = await fetch("/api/discover/grid-presets");
    const data = await res.json();
    setPresets(data.presets ?? []);
    setQuick(data.quickChips ?? []);
  };

  useEffect(() => { fetchPresets(); }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Grid Presets & Quick Filters (10.4, 16.6)</h1>
      <p className="text-sm text-muted-foreground">One-tap presets: Online now, Photo only, My type, compose with full sheet — 20 max</p>
      <button onClick={fetchPresets} className="px-3 py-1 border rounded text-sm">Load Presets</button>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Quick Chips</h4>
        <div className="flex flex-wrap gap-2">
          {quick.map((chip: any) => <span key={chip.id} className="px-3 py-1 border rounded-full text-xs">{chip.icon} {chip.label}</span>)}
        </div>
        <h4 className="font-semibold text-sm">Saved Presets ({presets.length}/20)</h4>
        {presets.map((p: any) => <div key={p.id} className="border rounded p-2 text-xs flex justify-between"><span>{p.icon ?? "⭐"} {p.name} {p.isQuick ? "(quick)" : ""}</span><span>{new Date(p.createdAt).toLocaleDateString()}</span></div>)}
      </div>
    </div>
  );
}
