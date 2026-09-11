"use client";

import { Heart, Zap, Crown, ShieldCheck, Star, Cpu } from "lucide-react";
import { cn, gradient } from "@/lib/utils";
import type { Candidate } from "@/lib/types";

export function ProfileCard({
  candidate,
  isTapped,
  onTap,
  onFavorite,
  onOpen,
  isAiRecommended,
}: {
  candidate: Candidate;
  isTapped: boolean;
  onTap: () => void;
  onFavorite: () => void;
  onOpen: () => void;
  isAiRecommended?: boolean;
}) {
  const photo = candidate.photos?.[0];
  const isTopMatch = candidate.matchScore >= 85;

  return (
    <div
      onClick={onOpen}
      className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface-2 transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-xl hover:shadow-gold/5"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={candidate.pseudo}
          width={400}
          height={533}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: gradient(candidate.pseudo) }}>
          <span className="text-5xl font-bold text-white/80">{candidate.pseudo[0]?.toUpperCase()}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />

      {/* top row */}
      <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
        <div className="flex flex-col gap-1">
          {candidate.online && (
            <span className="flex w-fit items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink">
              <span className="h-1 w-1 rounded-full bg-ink" /> Online
            </span>
          )}
          {isTopMatch && (
            <span className="flex w-fit items-center gap-0.5 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-ink">
              <Star className="h-2.5 w-2.5" /> Top match
            </span>
          )}
          {isAiRecommended && (
            <span className="flex w-fit items-center gap-0.5 rounded-full bg-purple-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
              <Cpu className="h-2.5 w-2.5" /> AI Recommended
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-ink/70 px-1.5 py-1 text-[11px] font-bold text-gold-soft backdrop-blur">
          <Crown className="h-3 w-3" />
          {candidate.matchScore}
        </div>
      </div>

      {/* favourite */}
      <button
        onClick={(e) => { e.stopPropagation(); onFavorite(); }}
        className={cn(
          "absolute bottom-3 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 backdrop-blur transition-all sm:opacity-0 sm:group-hover:opacity-100",
          candidate.isFavorite ? "text-rose-400 opacity-100" : "text-white/70 hover:text-rose-400"
        )}
        aria-label="Favorite"
      >
        <Heart className={cn("h-4 w-4", candidate.isFavorite && "fill-rose-400")} />
      </button>

      {/* info */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 pr-14">
        <div className="flex items-center gap-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-white">{candidate.pseudo}</h3>
          {candidate.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
        </div>
        <p className="truncate text-[11px] text-white/70">
          {candidate.age ?? "—"} · {candidate.distanceKm}km · {candidate.geo?.city ?? "Nearby"}
        </p>
        <div className="mt-1 flex gap-1 overflow-hidden">
          {candidate.tribes.slice(0, 2).map((t) => (
            <span key={t} className="truncate rounded-full bg-white/12 px-1.5 py-0.5 text-[9px] text-white/85 backdrop-blur">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* tap */}
      <button
        onClick={(e) => { e.stopPropagation(); onTap(); }}
        disabled={isTapped}
        className={cn(
          "absolute bottom-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all active:scale-90",
          isTapped ? "bg-emerald-500 text-ink" : "bg-gold text-ink hover:scale-110 hover:bg-gold-soft"
        )}
        aria-label={isTapped ? "Tapped" : "Tap to chat"}
      >
        {isTapped ? <span className="text-lg font-bold">✓</span> : <Zap className="h-5 w-5" />}
      </button>
    </div>
  );
}
