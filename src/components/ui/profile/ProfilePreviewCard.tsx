/**
 * ProfilePreviewCard — Canonical profile card, professional naming
 * Replaces ProfileCard (divine naming) with clean implementation
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
  const photos = profile.photos ?? [profile.avatar].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border overflow-hidden bg-background">
      <div className="relative aspect-[4/5] bg-muted">
        {photos.length > 0 ? (
          <img src={photos[currentPhoto]} alt={profile.displayName} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">U</div>
        )}

        {photos.length > 1 && (
          <div className="absolute top-2 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, idx) => (
              <button key={idx} onClick={() => setCurrentPhoto(idx)} className={`w-1 h-1 rounded-full ${idx === currentPhoto ? "bg-white w-4" : "bg-white/50"}`} />
            ))}
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1">
          <button className="w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-[10px]">...</button>
        </div>

        {profile.verification !== undefined && profile.verification >= 2 && (
          <div className="absolute bottom-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">V</div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold flex items-center gap-1">
              {profile.displayName ?? "Someone"}, {profile.age}
              {profile.verification !== undefined && profile.verification >= 2 && <span className="text-blue-500 text-xs">V</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {profile.city} {profile.area ? `• ${profile.area}` : ""} {profile.distance ? `• ${profile.distance}km` : ""}
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${profile.online ? "bg-green-500" : "bg-gray-400"}`} />
        </div>

        {profile.bio && <div className="text-xs line-clamp-2">{profile.bio}</div>}

        <div className="flex flex-wrap gap-1">
          {(profile.tribes ?? []).slice(0, 3).map((tribe) => (
            <span key={tribe} className="px-2 py-0.5 bg-muted rounded-full text-[10px]">
              {tribe}
            </span>
          ))}
          {(profile.interests ?? []).slice(0, 3).map((interest) => (
            <span key={interest} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px]">
              {interest}
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onTap} className="flex-1 py-2 bg-primary text-white rounded-full text-xs font-semibold">
            Tap
          </button>
          <button onClick={onFavorite} className="w-10 h-10 border rounded-full flex items-center justify-center text-xs">
            Fav
          </button>
          <button className="w-10 h-10 border rounded-full flex items-center justify-center text-xs">Msg</button>
        </div>
      </div>
    </div>
  );
}
