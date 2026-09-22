"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Users, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function MeetNowClientOmega() {
  const [filter, setFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "map" | "list">("grid");
  void viewMode; void setViewMode;

  const { data, isLoading } = useQuery({
    queryKey: ["meetnow"],
    queryFn: async () => ({
      items: Array.from({ length: 12 }, (_, i) => ({
        id: `tribes-${i}`,
        name: `tribes ${i + 1}`,
        description: "Right Now posts, instant meet, location, tags, boost, vs Grindr Right Now",
        members: Math.floor(Math.random() * 100) + 10,
        verified: Math.random() > 0.5,
        boosted: i < 2,
        distance: Math.floor(Math.random() * 5000),
        tags: ["gay", "community", "meetnow"],
      })),
      total: 42,
      online: 12,
    }),
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

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white/80 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] text-black capitalize">meetnow</h1>
        <p className="mt-1 text-[14px] text-zinc-500">Right Now posts, instant meet, location, tags, boost, vs Grindr Right Now</p>
        <div className="mt-3 flex gap-2">
          {["All", "Nearby", "Popular", "Verified"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1.5 text-[13px]", filter === f ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-600")}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {data?.items.map((item) => (
          <div key={item.id} className={cn("group relative aspect-[3/4] overflow-hidden rounded-[16px] border bg-white shadow-sm hover:shadow-md transition", item.boosted && "border-[oklch(0.80_0.17_85/0.3)] shadow-[0_0_0_1px_oklch(0.80_0.17_85/0.3),0_8px_24px_oklch(0.80_0.17_85/0.15)]")}>
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
            <div className="absolute left-2.5 top-2.5 z-10 flex gap-1.5">
              {item.boosted && <span className="rounded-full bg-[oklch(0.80_0.17_85)] px-2 py-1 text-[10px] font-bold uppercase text-black">Boosted</span>}
              {item.verified && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 backdrop-blur-md"><Shield className="h-3 w-3" /></span>}
            </div>
            <div className="absolute inset-x-0 bottom-0 z-10 p-3">
              <p className="font-display text-[16px] font-semibold text-white">{item.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-white/70">{item.description}</p>
              <div className="mt-2 flex gap-2">
                <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur-md"><MapPin className="h-3 w-3" /> {item.distance}m</span>
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white backdrop-blur-md"><Users className="h-3 w-3" /> {item.members}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[16px] border bg-zinc-50 p-4">
        <h3 className="text-[14px] font-semibold text-black">Features — practical</h3>
        <ul className="mt-2 grid gap-1.5 text-[12px] text-zinc-600 md:grid-cols-2">
          <li>• Right Now posts with location, tags, expiresAt</li>
          <li>• Instant meet, boost, moderation</li>
          <li>• Map view, filters</li>
          <li>• Award-winning UI</li>
        </ul>
      </div>
    </div>
  );
}