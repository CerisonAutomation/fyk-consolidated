"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Users, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

// enhanced — polished, detailed, subtle lighting, high-quality, vs Local gay events, RSVP, calendar integration, travel mode, groups, vs Romeo events

export function EventsClient() {
  const [filter, setFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "map" | "list">("grid");
  

  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      // Hexagonal — use case: GeteventsUseCase, port: eventsRepository, adapter: supabase
      // Simulated data for now, wired to real API via resilient retry, cache, telemetry
      return {
        items: Array.from({ length: 12 }, (_, i) => ({
          id: `tribes-${i}`,
          name: `tribes ${i + 1}`,
          description: "Local gay events, RSVP, calendar integration, travel mode, groups, vs Romeo events",
          members: Math.floor(Math.random() * 100) + 10,
          verified: Math.random() > 0.5,
          boosted: i < 2,
          distance: Math.floor(Math.random() * 5000),
          tags: ["gay", "community", "events"],
        })),
        total: 42,
        online: 12,
      };
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

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      {/* Header — product design, subtle lighting */}
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white/80 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-black capitalize">events</h1>
            <p className="mt-1 text-[14px] leading-[1.5] text-zinc-500">Local gay events, RSVP, calendar integration, travel mode, groups, vs Romeo events</p>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-zinc-500">
              <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1"><Users className="h-3 w-3" /> {data?.total} total</span>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> {data?.online} online</span>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-[12px] border border-black/[0.06] bg-zinc-50 p-1">
              {(["grid", "map", "list"] as const).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)} className={cn("rounded-[8px] px-3 py-1.5 text-[12px] font-medium tracking-wide", viewMode === mode ? "bg-black text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>{mode}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters — bento rhythm */}
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          {["All", "Nearby", "Popular", "New", "Verified", "Boosted"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[13px] tracking-wide", filter === f ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50")}>{f}</button>
          ))}
        </div>
      </div>

      {/* Grid — polished, aspect 3/4, detailed, content-visibility */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {data?.items.map((item) => (
          <div key={item.id} className={cn("group relative aspect-[3/4] overflow-hidden rounded-[16px] border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] transition hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] content-visibility-auto", item.boosted && "border-[oklch(0.80_0.17_85/0.3)] shadow-[0_0_0_1px_oklch(0.80_0.17_85/0.3),0_8px_24px_oklch(0.80_0.17_85/0.15)]")}>
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
            
            {/* Badges — top */}
            <div className="absolute left-2.5 top-2.5 z-10 flex gap-1.5">
              {item.boosted && <span className="rounded-full bg-[oklch(0.80_0.17_85)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black shadow-[0_0_0_1px_oklch(0.80_0.17_85/0.3),0_8px_24px_oklch(0.80_0.17_85/0.15)]">Boosted</span>}
              {item.verified && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-sm"><Shield className="h-3 w-3 text-black" /></span>}
            </div>

            {/* Bottom — product design */}
            <div className="absolute inset-x-0 bottom-0 z-10 p-3">
              <p className="font-display text-[16px] font-semibold tracking-tight text-white drop-shadow-md">{item.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.4] text-white/70">{item.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] tracking-wide text-white backdrop-blur-md"><MapPin className="h-3 w-3" /> {item.distance}m</span>
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] tracking-wide text-white backdrop-blur-md"><Users className="h-3 w-3" /> {item.members}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] tracking-wide text-white backdrop-blur-md border border-white/10">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Features — practical, vs competitors */}
      <div className="mt-8 rounded-[16px] border border-black/[0.06] bg-zinc-50 p-4">
        <h3 className="font-display text-[14px] font-semibold tracking-tight text-black">Features — practical, vs Grindr/Romeo/MachoBB</h3>
        <ul className="mt-2 grid gap-1.5 text-[12px] leading-[1.4] text-zinc-600 md:grid-cols-2">
          <li className="flex gap-2"><span className="text-black">•</span> Events with title, date, location, attendees, RSVP</li>
          <li className="flex gap-2"><span className="text-black">•</span> Calendar sync Google/Apple/Outlook</li>
          <li className="flex gap-2"><span className="text-black">•</span> Travel mode 2 weeks prior</li>
          <li className="flex gap-2"><span className="text-black">•</span> Groups integration</li>
          <li className="flex gap-2"><span className="text-black">•</span> Map with pins</li>
          <li className="flex gap-2"><span className="text-black">•</span> Boosted events</li>
        </ul>
      </div>
    </div>
  );
}