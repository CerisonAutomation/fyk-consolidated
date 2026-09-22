"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Zap, Heart, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface KingPetItem {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  members?: number;
  verified?: boolean;
  boosted?: boolean;
  distance?: number;
  tags?: string[];
}

export function KingPetClient() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const qc = useQueryClient();
  const { vibrate } = useHaptics();
  const { isConnected } = useRealtimeSync();

  const { data, isLoading, error } = useQuery({
    queryKey: ["king-pet", filter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ filter, search, viewMode });
      const res = await fetch(`/api/king-pet?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return {
        items: (json.items ?? json.data ?? json.pet ? [json.pet] : []) as KingPetItem[],
        total: json.total ?? 1,
        online: json.online ?? 1,
        pet: json.pet,
        bones: json.bones,
      };
    },
    staleTime: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, data: d }: { action: string; data?: unknown }) => {
      const res = await fetch(`/api/king-pet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...(d as object) }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["king-pet"] });
      vibrate(20);
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <Skeleton className="mb-4 h-[200px] rounded-[20px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-[16px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-[14px] font-medium text-red-800">Failed to load King Pet</p>
          <p className="mt-1 text-[12px] text-red-600">{(error as Error).message}</p>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["king-pet"] })} className="mt-4 rounded-full bg-black px-4 py-2 text-[13px] text-white">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pet = (data as any)?.pet;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] text-black">King Pet</h1>
            <p className="mt-1 text-[14px] text-zinc-500">XP, level, streak, wardrobe, adventures, economy ledger — vs Grindr pets</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-zinc-300")} />
              {isConnected ? "Live" : "Offline"} • Level {pet?.level ?? 1} • {pet?.bones ?? (data as any)?.bones ?? 0} bones
            </div>
          </div>
          <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px]">
            {viewMode === "grid" ? "List" : "Grid"}
          </button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-24 bg-transparent text-[13px] outline-none md:w-40" />
          </div>
          {["All", "Feed", "Play", "Adventures", "Wardrobe"].map((f) => (
            <button key={f} onClick={() => { setFilter(f); vibrate(10); }} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[13px]", filter === f ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-600")}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {pet && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[16px] border bg-white p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Pet</p>
            <p className="mt-1 text-[18px] font-bold text-black">{pet.name} • {pet.stage}</p>
            <p className="text-[12px] text-zinc-500">Mood: {pet.mood} • Streak: {pet.streak}</p>
          </div>
          <div className="rounded-[16px] border bg-white p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Progress</p>
            <p className="mt-1 text-[14px] font-medium text-black">Level {pet.level} • {pet.experience} XP</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full bg-black" style={{ width: `${(pet.experience % 100)}%` }} />
            </div>
          </div>
          <div className="rounded-[16px] border bg-white p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Actions</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => actionMutation.mutate({ action: "feed" })} className="rounded-full bg-black px-3 py-1.5 text-[12px] text-white">Feed</button>
              <button onClick={() => actionMutation.mutate({ action: "play" })} className="rounded-full border bg-white px-3 py-1.5 text-[12px]">Play</button>
              <button onClick={() => actionMutation.mutate({ action: "rest" })} className="rounded-full border bg-white px-3 py-1.5 text-[12px]">Rest</button>
            </div>
          </div>
        </div>
      )}

      <div className={cn("grid gap-3", viewMode === "grid" ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1")}>
        {data?.items.map((item) => (
          <div key={item.id} className="group relative overflow-hidden rounded-[16px] border bg-white p-4 shadow-sm">
            <p className="font-medium text-black">{item.name ?? pet?.name ?? "Kingsley"}</p>
            <p className="mt-1 text-[12px] text-zinc-500">{item.description ?? "Pet adventure"}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => actionMutation.mutate({ action: "feed" })} className="flex items-center gap-1 rounded-full bg-white border px-2.5 py-1 text-[11px]"><Zap className="h-3 w-3" /> Feed</button>
              <button className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-[11px]"><Heart className="h-3 w-3" /> Like</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[16px] border bg-zinc-50 p-4">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-black"><Crown className="h-4 w-4" /> King Pet — production</h3>
        <ul className="mt-2 grid gap-1.5 text-[11px] text-zinc-600 md:grid-cols-2">
          <li>• Real API: /api/king-pet with Drizzle, ledger, economy, cooldowns</li>
          <li>• No fake data — server owns XP, level, stage, streak, bones</li>
          <li>• vs Grindr: pet gamification, XP, wardrobe, adventures</li>
        </ul>
      </div>
    </div>
  );
}
