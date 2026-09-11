import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Heart,
  Pause,
  Play,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { px } from "@/lib/data";
import { useStore } from "@/lib/store";
import { haptic } from "@/lib/platform";
import { useAuth } from "./EntryShell";

export type MediaItem = {
  id: string;
  kind: "photo" | "video";
  /** Remote id for seeded imagery, or a local object URL. */
  photo?: number;
  url?: string;
  poster?: number;
  caption?: string;
  ownerId: string;
  ownerName: string;
  sensitive?: boolean;
};

/**
 * Full-page media viewer.
 * Handles authorized media after the chat/album service has downloaded it,
 * with swipe/keyboard navigation and a watermarked screenshot deterrent.
 * Access policy and open-count state remain on the chat object, not this viewer.
 */
export function MediaViewer() {
  const {
    media, mediaIndex, setMediaIndex, closeMedia, toast,
  } = useStore();
  const { profile } = useAuth();
  const viewerName = profile.display_name || profile.handle || "Signed-in viewer";

  const item = media[mediaIndex];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touchX = useRef(0);

  /* privacy: blur the moment the tab loses focus */
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = mediaIndex + delta;
      if (next >= 0 && next < media.length) setMediaIndex(next);
    },
    [mediaIndex, media.length, setMediaIndex],
  );

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMedia();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [item, closeMedia, go]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, mediaIndex]);

  if (!item) return null;

  const src = item.url ?? (item.photo ? px(item.photo, 1400, 1900) : "");
  const posterSrc = item.poster ? px(item.poster, 900, 1200) : src;

  return (
    <div className="fixed inset-0 z-[135] flex flex-col bg-black">
      {/* header */}
      <header className="relative z-20 flex items-center gap-3 bg-gradient-to-b from-black/85 to-transparent px-4 pb-8 pt-4">
        <button
          type="button"
          onClick={closeMedia}
          aria-label="Close"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{item.ownerName}</p>
          <p className="flex items-center gap-2 text-[12px] text-white/60">
            {mediaIndex + 1} of {media.length}
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Authorized in-app view</span>
          </p>
        </div>
      </header>

      {/* stage */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? 0)}
        onTouchEnd={(e) => {
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        }}
      >
        {item.kind === "video" ? (
          <video
            ref={videoRef}
            src={item.url}
            poster={posterSrc}
            playsInline
            loop
            muted={muted}
            className={cn("max-h-full max-w-full object-contain transition-[filter]", hidden && "blur-2xl")}
          />
        ) : (
          <img
            src={src}
            alt={item.caption ?? ""}
            className={cn("max-h-full max-w-full object-contain transition-[filter]", hidden && "blur-2xl")}
          />
        )}

        {/* watermark — deterrence, never prevention */}
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-24deg] select-none text-[clamp(18px,5vw,34px)] font-bold tracking-wide text-white/[0.07]">
            {viewerName} · {new Date().toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
          </span>
        </span>

        {hidden && (
          <p className="absolute inset-x-0 bottom-8 z-20 text-center text-[13px] text-white/70">
            Hidden while you're on another tab.
          </p>
        )}

        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={mediaIndex === 0}
              aria-label="Previous"
              className="press absolute left-3 z-20 hidden h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 disabled:opacity-25 sm:grid"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={mediaIndex === media.length - 1}
              aria-label="Next"
              className="press absolute right-3 z-20 hidden h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 disabled:opacity-25 sm:grid"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* footer */}
      <footer className="safe-b relative z-20 bg-gradient-to-t from-black/90 to-transparent px-4 pb-5 pt-10">
        {item.caption && (
          <p className="mx-auto mb-3 max-w-2xl text-center text-[14px] leading-relaxed text-white/85">{item.caption}</p>
        )}

        {media.length > 1 && (
          <div className="mb-3 flex justify-center gap-1.5">
            {media.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMediaIndex(i)}
                aria-label={`Item ${i + 1}`}
                className={cn("h-1.5 rounded-full transition-all", i === mediaIndex ? "w-7 bg-gold" : "w-1.5 bg-white/35")}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          {item.kind === "video" && (
            <>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause" : "Play"}
                className="press grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
              >
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                className="press grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              haptic("like");
              toast(`Liked ${item.ownerName}'s photo`, "gold");
            }}
            className="press grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-gold hover:text-black"
          >
            <Heart className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() =>
              toast(`Saving is disabled here: ${item.ownerName} shared this inside FYK. Ask them directly if you'd like a copy.`, "violet")
            }
            className="press grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/45 backdrop-blur"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => toast("Report captured locally: No remote moderation queue receives this yet.", "live")}
            className="press grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-live hover:text-white"
          >
            <ShieldAlert className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/40">
          <Sparkles className="h-3 w-3" />
          Watermarked with your name. Screenshots are deterred, not prevented — please respect the sender.
        </p>
      </footer>
    </div>
  );
}
