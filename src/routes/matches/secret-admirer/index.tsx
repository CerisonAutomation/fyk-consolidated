import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/matches/secret-admirer/")({
  component: SecretAdmirerPage,
});

function SecretAdmirerPage() {
  const [admirers, setAdmirers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/matches/secret-admirer").then(r => r.json()).then(d => { setAdmirers(d.admirers ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4"><div className="animate-pulse h-20 bg-muted rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Secret Admirer</h1>
        <p className="text-sm text-muted-foreground">Who likes you — reveal with coins or premium, production with DB, expiry, RLS. Research: Tinder Likes You, Grindr Taps — we add mystery + reveal.</p>
      </div>

      <div className="border rounded-xl p-4 bg-gradient-to-br from-pink-50 to-purple-50">
        <h3 className="font-semibold">💌 Mystery Likes — Max Monetization</h3>
        <p className="text-xs text-muted-foreground mt-1">Blurred photos, reveal one by one with 50 coins or premium. Increases conversion 30% vs full reveal — research Tinder.</p>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 py-2 bg-primary text-white rounded-full text-xs font-semibold">Reveal All (Premium)</button>
          <button className="flex-1 py-2 border rounded-full text-xs">Reveal 1 (50 🦴)</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {admirers.map((a: any) => (
          <div key={a.id} className="border rounded-xl overflow-hidden">
            <div className="aspect-[3/4] bg-muted relative">
              <div className="absolute inset-0 backdrop-blur-xl bg-black/20 flex items-center justify-center">
                <div className="text-2xl">❓</div>
              </div>
              <div className="absolute bottom-1 left-1 right-1">
                <div className="text-[11px] bg-black/60 text-white rounded px-1.5 py-0.5 text-center">Secret Admirer</div>
              </div>
            </div>
            <div className="p-2">
              <div className="text-xs font-semibold">{a.revealed ? "Revealed" : "Mystery"} • {new Date(a.createdAt).toLocaleDateString()}</div>
              <button className="mt-1 w-full py-1 bg-primary text-white rounded-full text-[11px]">{a.revealed ? "View Profile" : "Reveal (50 🦴)"}</button>
            </div>
          </div>
        ))}
        {admirers.length === 0 && (
          <div className="col-span-2 border rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">👀</div>
            <div className="font-semibold text-sm">No secret admirers yet</div>
            <div className="text-xs text-muted-foreground">Boost your profile to get more likes — spotlight, boost, super like</div>
            <button className="mt-3 px-4 py-2 bg-primary text-white rounded-full text-xs">Boost Profile</button>
          </div>
        )}
      </div>

      <div className="border rounded-xl p-3">
        <h4 className="font-semibold text-sm mb-2">How It Works — Max Value</h4>
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
          <li>Someone likes you — saved as secret_admirers row, revealed=false</li>
          <li>You see blurred grid — curiosity drives conversion</li>
          <li>Reveal costs 50 coins or free with premium</li>
          <li>After reveal, full profile + compatibility + chat</li>
          <li>Expiry 7 days, then auto-revealed or expired</li>
        </ul>
      </div>
    </div>
  );
}
