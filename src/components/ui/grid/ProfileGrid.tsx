/**
 * ProfileGrid — Canonical grid, performance optimized
 * Replaces CascadeGrid (divine naming) with professional naming
 */

import { useState, useEffect, useRef } from "react";

export type GridProfile = {
  id: string;
  name: string;
  age: number;
  photo: string;
  distance: number | null;
  status: "online" | "active" | "offline";
  verified: boolean;
  compatibility?: number;
  isBoosted?: boolean;
  isFresh?: boolean;
};

export function ProfileGrid({ profiles, columns = 2, onProfileClick }: { profiles: GridProfile[]; columns?: number; onProfileClick?: (id: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(20);
  const lastRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount((c) => Math.min(profiles.length, c + 20));
      }
    });
    if (lastRef.current) observer.observe(lastRef.current);
    return () => observer.disconnect();
  }, [profiles.length]);

  const visible = profiles.slice(0, visibleCount);

  if (profiles.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-4xl mb-2">Search</div>
        <div className="font-semibold">No profiles found</div>
        <div className="text-sm text-muted-foreground">Adjust your filters</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className={`grid gap-1 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {visible.map((profile, idx) => (
          <div
            key={profile.id}
            ref={idx === visible.length - 1 ? lastRef : null}
            onClick={() => onProfileClick?.(profile.id)}
            className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted cursor-pointer group"
            style={{ contain: "layout style paint" }}
          >
            <img
              src={profile.photo}
              alt={profile.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              style={{ contentVisibility: "auto" } as React.CSSProperties}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute top-1 left-1 right-1 flex justify-between">
              <div className="flex gap-1">
                {profile.isBoosted && <span className="px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] rounded font-bold">BOOSTED</span>}
                {profile.isFresh && <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] rounded font-bold">FRESH</span>}
              </div>
              {profile.verified && <span className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px]">V</span>}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm truncate">
                  {profile.name}, {profile.age}
                </span>
                <span className={`w-2 h-2 rounded-full ${profile.status === "online" ? "bg-green-500" : profile.status === "active" ? "bg-yellow-500" : "bg-gray-500"}`} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] opacity-80">{profile.distance ? `${profile.distance}km` : "--"}</span>
                {profile.compatibility && <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded">{profile.compatibility}%</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {visibleCount < profiles.length && (
        <div className={`grid gap-1 mt-1 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
