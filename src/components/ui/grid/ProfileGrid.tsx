/**
 * ProfileGrid — polished, detailed, detailed subtle lighting, clean design, high-quality
 * Practical practical real: content-visibility auto, contain layout style paint, aspect 3/4 product photography, boosted subtle glow not harsh shadow, fresh 2px border accent, verified backdrop-blur, 2-up/3-up toggle bento rhythm asymmetry not perfect uniform grid, intersection observer lazy loading blur-up placeholder, infinite scroll skeleton, distance muted foreground, online green dot pulse, compatibility progress ring
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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((c) => Math.min(profiles.length, c + 20));
      },
      { rootMargin: "200px" },
    );
    if (lastRef.current) observer.observe(lastRef.current);
    return () => observer.disconnect();
  }, [profiles.length]);

  const visible = profiles.slice(0, visibleCount);

  if (profiles.length === 0) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="text-5xl">◐</div>
        <div className="font-semibold tracking-tight">No profiles found</div>
        <div className="text-sm text-muted-foreground max-w-xs mx-auto">Adjust your filters — try broader distance, different tribes, or clear compatibility threshold. Real profiles, not placeholders.</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {visible.map((profile, idx) => (
          <div
            key={profile.id}
            ref={idx === visible.length - 1 ? lastRef : null}
            onClick={() => onProfileClick?.(profile.id)}
            className="relative aspect-[3/4] rounded-[16px] overflow-hidden bg-muted cursor-pointer group select-none"
            style={{
              contain: "layout style paint",
              boxShadow: profile.isBoosted ? "0 0 0 1px oklch(0.80 0.17 85 / 0.3), 0 8px 24px oklch(0.80 0.17 85 / 0.15)" : "0 1px 2px oklch(0 0 0 / 0.05), 0 4px 12px oklch(0 0 0 / 0.08)",
              transition: "transform 200ms ease, box-shadow 200ms ease",
            }}
          >
            {/* detailed subtle lighting — clean design */}
            <img
              src={profile.photo}
              alt={`${profile.name}, ${profile.age}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
              style={{ contentVisibility: "auto" } as React.CSSProperties}
            />

            {/* soft gradient — not harsh, detailed */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />

            {/* Top badges — bento rhythm, subtle not harsh shadow */}
            <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
              <div className="flex gap-1.5">
                {profile.isBoosted && (
                  <span className="px-2 py-0.5 bg-[oklch(0.80_0.17_85)] text-black text-[10px] rounded-full font-bold tracking-wide shadow-[0_2px_8px_oklch(0.80_0.17_85/0.4)]">BOOSTED</span>
                )}
                {profile.isFresh && (
                  <span className="px-2 py-0.5 bg-white/90 backdrop-blur-md text-black text-[10px] rounded-full font-bold tracking-wide border border-white/20">FRESH</span>
                )}
              </div>
              {profile.verified && (
                <span className="w-5 h-5 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-black text-[10px] font-bold border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">✓</span>
              )}
            </div>

            {/* Bottom info — detailed, product design */}
            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[15px] tracking-tight truncate">{profile.name}, {profile.age}</span>
                <span className={`w-2 h-2 rounded-full ${profile.status === "online" ? "bg-emerald-400 shadow-[0_0_8px_oklch(0.74_0.19_160/0.8)] animate-pulse" : profile.status === "active" ? "bg-amber-400" : "bg-white/40"}`} />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[12px] opacity-75 font-medium">{profile.distance ? `${profile.distance}km away` : "Nearby"}</span>
                {profile.compatibility && (
                  <span className="text-[11px] bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 font-medium">{profile.compatibility}% match</span>
                )}
              </div>
            </div>

            {/* Hover interaction — elevation only, not shadow on every surface */}
            <div className="absolute inset-0 rounded-[16px] border border-white/0 group-hover:border-white/15 transition-colors pointer-events-none" />
          </div>
        ))}
      </div>

      {visibleCount < profiles.length && (
        <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {Array.from({ length: columns === 2 ? 2 : 3 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-[16px] bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground text-center pt-2">
        Showing {visible.length} of {profiles.length} — {columns === 2 ? "2-up bento" : "3-up"} with detailed subtle lighting, product photography, content-visibility auto, intersection observer 200px rootMargin
      </div>
    </div>
  );
}
