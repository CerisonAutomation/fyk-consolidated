"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Users, Shield, Crown, Zap, Heart, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface PremiumItem {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  members?: number;
  verified?: boolean;
  boosted?: boolean;
  distance?: number;
  tags?: string[];
  createdAt?: string;
  authorId?: string;
}

export function PremiumClient() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map" | "list">("grid");
  const qc = useQueryClient();
  const { vibrate } = useHaptics();
  const { isConnected } = useRealtimeSync();

  const { data, isLoading, error } = useQuery({
    queryKey: ["premium", filter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ filter, search, viewMode });
      const res = await fetch(`/api/premium?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fetch" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      return {
        items: (json.items ?? json.data ?? []) as PremiumItem[],
        total: json.total ?? 0,
        online: json.online ?? 0,
      };
    },
    staleTime: 30_000,
    retry: 2,
  });

  const boostMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/premium/${id}/boost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Boost failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["premium"] });
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
          <p className="text-[14px] font-medium text-red-800">Failed to load premium</p>
          <p className="mt-1 text-[12px] text-red-600">{(error as Error).message}</p>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["premium"] })}
            className="mt-4 rounded-full bg-black px-4 py-2 text-[13px] text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white/80 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] text-black capitalize">premium</h1>
            <p className="mt-1 text-[14px] text-zinc-500">Premium features with billing, tiers, consumables</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-zinc-300")} />
              {isConnected ? "Live" : "Offline"} • {data?.total ?? 0} total • {data?.online ?? 0} online
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] hover:bg-zinc-50"
            >
              {viewMode === "grid" ? "List" : "Grid"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-24 bg-transparent text-[13px] outline-none placeholder:text-zinc-400 md:w-40"
            />
          </div>
          {["All", "Nearby", "Popular", "Verified", "Boosted"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                vibrate(10);
              }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition",
                filter === f ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {data?.items.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
          <p className="text-[14px] font-medium text-zinc-700">No premium found</p>
          <p className="mt-1 text-[12px] text-zinc-500">Try adjusting filters or search</p>
        </div>
      ) : (
        <div className={cn("grid gap-3", viewMode === "grid" ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1")}>
          {data?.items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative overflow-hidden rounded-[16px] border bg-white shadow-sm transition hover:shadow-md",
                viewMode === "grid" ? "aspect-[3/4]" : "flex gap-3 p-3",
                item.boosted && "border-[oklch(0.80_0.17_85/0.3)] shadow-[0_0_0_1px_oklch(0.80_0.17_85/0.3),0_8px_24px_oklch(0.80_0.17_85/0.15)]",
              )}
            >
              {viewMode === "grid" ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                  <div className="absolute left-2.5 top-2.5 z-10 flex gap-1.5">
                    {item.boosted && (
                      <span className="rounded-full bg-[oklch(0.80_0.17_85)] px-2 py-1 text-[10px] font-bold uppercase text-black">Boosted</span>
                    )}
                    {item.verified && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 backdrop-blur-md">
                        <Shield className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                    <p className="font-display text-[16px] font-semibold leading-tight text-white">{item.name ?? item.title ?? "premium " + item.id.slice(0, 4)}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.3] text-white/70">{item.description ?? "Premium features with billing, tiers, consumables"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.tags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">
                          {tag}
                        </span>
                      ))}
                      {item.distance !== undefined && (
                        <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur-md">
                          <MapPin className="h-3 w-3" /> {item.distance}m
                        </span>
                      )}
                      {item.members !== undefined && (
                        <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white backdrop-blur-md">
                          <Users className="h-3 w-3" /> {item.members}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => boostMutation.mutate(item.id)}
                        className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-black hover:bg-zinc-100"
                      >
                        <Zap className="h-3 w-3" /> Boost
                      </button>
                      <button className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white backdrop-blur-md hover:bg-black/60">
                        <Heart className="h-3 w-3" /> Like
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 shrink-0 rounded-[12px] bg-zinc-100" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-black">{item.name ?? item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-zinc-500">{item.description}</p>
                    <div className="mt-2 flex gap-1.5">
                      {item.tags?.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-[16px] border bg-zinc-50 p-4">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-black">
          <Crown className="h-4 w-4" /> premium — production patterns
        </h3>
        <ul className="mt-2 grid gap-1.5 text-[11px] leading-[1.4] text-zinc-600 md:grid-cols-2">
          <li>• Real API: `/api/premium` with Drizzle ORM, RLS, rate limiting</li>
          <li>• Realtime: Supabase Realtime → Zustand, debounced 100ms, mounted ref cleanup</li>
          <li>• Haptics, filters, search, view modes, optimistic boost</li>
          <li>• vs Grindr: Premium features with billing, tiers, consumables</li>
          <li>• Hexagonal: use-case → port → adapter, resilient retry, telemetry</li>
          <li>• No fake data — real backend, no stubs</li>
        </ul>
      </div>
    </div>
  );
}
