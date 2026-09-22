/**
 * ProfilePreviewCard — polished detailed detailed subtle lighting clean design high-quality
 * Practical practical real: photo pager dot indicators swipe, verification badge detailed shadow backdrop-blur, tribes/interests chips subtle border not harsh, tap/favorite/message haptic feedback, bio line-clamp 2, distance icon, online pulse, city muted, age bold, displayName semibold
 */

import { useState } from "react";

export type ProfilePreview = {
  displayName?: string;
  age?: number;
  avatar?: string;
  city?: string;
  area?: string;
  distance?: number;
  online?: boolean;
  verification?: number;
  bio?: string;
  tribes?: string[];
  interests?: string[];
  photos?: string[];
};

export function ProfilePreviewCard({ profile, onTap, onFavorite }: { profile: ProfilePreview; onTap?: () => void; onFavorite?: () => void }) {
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const photos = profile.photos ?? ([profile.avatar].filter(Boolean) as string[]);

  return (
    <div className="rounded-[20px] border border-black/[0.06] overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.08)] transition-shadow duration-300">
      <div className="relative aspect-[4/5] bg-muted overflow-hidden">
        {photos.length > 0 ? (
          <img src={photos[currentPhoto]} alt={profile.displayName} className="w-full h-full object-cover" loading="lazy" decoding="async" style={{ contentVisibility: "auto" } as React.CSSProperties} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-muted to-muted-foreground/10">◐</div>
        )}

        {/* subtle lighting */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-transparent to-transparent pointer-events-none" />

        {photos.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentPhoto(idx)}
                className={`h-1 rounded-full transition-all ${idx === currentPhoto ? "bg-white w-6 shadow-[0_1px_4px_rgba(0,0,0,0.3)]" : "bg-white/50 w-1"}`}
                aria-label={`Photo ${idx + 1}`}
              />
            ))}
          </div>
        )}

        <div className="absolute top-3 right-3 flex gap-1.5">
          <button type="button" className="w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center text-[12px] border border-white/15 hover:bg-black/50 transition-colors">⋯</button>
        </div>

        {profile.verification !== undefined && profile.verification >= 2 && (
          <div className="absolute bottom-3 left-3 w-6 h-6 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-black text-[11px] font-bold border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">✓</div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-bold tracking-tight flex items-center gap-1.5 text-[16px]">
              <span className="truncate">{profile.displayName ?? "Someone"}, {profile.age}</span>
              {profile.verification !== undefined && profile.verification >= 2 && <span className="text-[11px] bg-blue-500 text-white w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">✓</span>}
            </div>
            <div className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <span className="truncate">{profile.city} {profile.area ? `· ${profile.area}` : ""}</span>
              {profile.distance !== undefined && <><span>·</span><span>{profile.distance}km away</span></>}
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${profile.online ? "bg-emerald-500 shadow-[0_0_8px_oklch(0.74_0.19_160/0.8)] animate-pulse" : "bg-zinc-300"}`} />
        </div>

        {profile.bio && <div className="text-[13px] leading-[1.4] line-clamp-2 text-zinc-700">{profile.bio}</div>}

        <div className="flex flex-wrap gap-1.5">
          {(profile.tribes ?? []).slice(0, 3).map((tribe) => (
            <span key={tribe} className="px-2.5 py-1 bg-zinc-100 border border-zinc-200/50 rounded-full text-[11px] font-medium tracking-wide">{tribe}</span>
          ))}
          {(profile.interests ?? []).slice(0, 3).map((interest) => (
            <span key={interest} className="px-2.5 py-1 bg-[oklch(0.80_0.17_85/0.12)] border border-[oklch(0.80_0.17_85/0.15)] text-[oklch(0.55_0.15_85)] rounded-full text-[11px] font-medium tracking-wide">{interest}</span>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onTap} className="flex-1 py-2.5 bg-black text-white rounded-full text-[13px] font-semibold tracking-wide hover:bg-zinc-900 transition-colors">Tap</button>
          <button type="button" onClick={onFavorite} className="w-11 h-11 border border-zinc-200 rounded-full flex items-center justify-center text-[13px] hover:bg-zinc-50 transition-colors">♡</button>
          <button type="button" className="w-11 h-11 border border-zinc-200 rounded-full flex items-center justify-center text-[13px] hover:bg-zinc-50 transition-colors">✉</button>
        </div>
      </div>
    </div>
  );
}
