"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Ruler, Crown, ShieldCheck, Heart, Zap, MessageSquare, Flag, StickyNote, Weight, Briefcase, Languages } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { Candidate, AlbumItem } from "@/lib/types";
import { Button, Badge, Skeleton, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function UserProfileClient({ userId }: { userId: string }) {
  const router = useRouter();
  const pushToast = useAppStore((s) => s.pushToast);
  const me = useAppStore((s) => s.user);
  const [icebreakers, setIcebreakers] = useState<string[] | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const isMe = me?.id === userId;

  const { data, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const r = await api<{ candidates: Candidate[] }>("/api/discover");
      return r.candidates.find((c) => c.id === userId) ?? null;
    },
    enabled: !isMe,
  });

  const { data: albums } = useQuery({
    queryKey: ["albums", userId],
    queryFn: () =>
      api<{ albums: AlbumItem[] }>(`/api/social?view=albums&userId=${userId}`).then((r) => r.albums),
  });

  // record the view
  const trackView = useMutation({
    mutationFn: () => api("/api/discover", { method: "POST", body: { targetId: userId } }),
  });
  useEffect(() => { if (!isMe) trackView.mutate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const tap = useMutation({
    mutationFn: () => api<{ isMatch: boolean }>("/api/taps", { method: "POST", body: { targetId: userId } }),
    onSuccess: (r) => {
      pushToast(r.isMatch ? "It's a match! ✨" : "Tap sent 👑", r.isMatch ? "info" : "success");
    },
  });

  const fav = useMutation({
    mutationFn: () =>
      api<{ favorited: boolean }>("/api/social", { method: "POST", body: { action: "favorite", targetId: userId } }),
    onSuccess: (r) => pushToast(r.favorited ? "Added to favorites ❤️" : "Removed", r.favorited ? "success" : "info"),
  });

  const message = useMutation({
    mutationFn: async () => {
      const r = await api<{ conversationId: string }>("/api/conversations", {
        method: "POST", body: { targetId: userId },
      });
      return r.conversationId;
    },
    onSuccess: (cid) => router.push(`/messages?c=${cid}`),
  });

  const saveNote = useMutation({
    mutationFn: () => api("/api/notes", { method: "POST", body: { targetId: userId, content: note } }),
    onSuccess: () => { pushToast("Private note saved 📝"); setShowNote(false); setNote(""); },
  });

  const report = useMutation({
    mutationFn: (reason: string) =>
      api("/api/safety/reports", { method: "POST", body: { reportedId: userId, reason } }),
    onSuccess: () => pushToast("Report submitted — reviewed 24/7.", "info"),
  });

  if (isMe) {
    return (
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => router.push("/profile")} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to my profile
        </Button>
        <EmptyState icon="👤" title="This is you!" description="Edit your profile to see changes here." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <EmptyState
          icon="🚫"
          title="Profile unavailable"
          description="They may have blocked you, gone incognito, or deactivated."
        />
      </div>
    );
  }

  const u = data;

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* hero */}
      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="relative h-64 sm:h-80">
          {u.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.photos[0]} alt={u.pseudo} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-surface-2" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <div className="absolute right-4 top-4 rounded-2xl bg-ink/70 px-3 py-2 text-center backdrop-blur">
            <div className="text-2xl font-bold leading-none text-gradient-gold">{u.matchScore}%</div>
            <div className="text-[9px] uppercase tracking-wider text-muted">AI match</div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{u.pseudo}</h1>
            {u.verified && <Badge color="gold"><ShieldCheck className="h-3 w-3" /> Verified</Badge>}
            <Badge color="purple">{u.tier}</Badge>
            {u.online && <Badge color="green">Online</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{u.age ?? "—"} yrs</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{u.distanceKm}km · {u.geo?.city}</span>
            {u.height && <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{u.height}cm</span>}
            <span>{u.views_count} views</span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-white/90">{u.description}</p>

          {/* actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => tap.mutate()} disabled={tap.isPending}>
              <Zap className="h-4 w-4" /> Tap to chat
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => message.mutate()}>
              <MessageSquare className="h-4 w-4" /> Message
            </Button>
            <button
              onClick={() => fav.mutate()}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                u.isFavorite ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-line bg-surface-2 text-muted hover:text-rose-400"
              )}
            >
              <Heart className={cn("h-4 w-4", u.isFavorite && "fill-rose-400")} />
            </button>
            <button
              onClick={() => setShowNote((s) => !s)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted hover:text-gold"
            >
              <StickyNote className="h-4 w-4" />
            </button>
            <button
              onClick={() => report.mutate("Other")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted hover:text-rose-400"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>

          {showNote && (
            <div className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.06] p-3">
              <p className="mb-2 text-xs font-medium text-gold-soft">Private note about {u.pseudo}</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Only visible to you…"
                className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
              />
              <Button size="sm" className="mt-2 w-full" onClick={() => saveNote.mutate()} disabled={!note.trim()}>
                Save note
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* details */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {u.body_type && <Detail icon={<Weight className="h-4 w-4" />} label={u.body_type} />}
        {u.occupation && <Detail icon={<Briefcase className="h-4 w-4" />} label={u.occupation} />}
        {u.languages.length > 0 && <Detail icon={<Languages className="h-4 w-4" />} label={u.languages.join(", ")} />}
        <Detail icon={<Crown className="h-4 w-4" />} label={`Trust ${u.trust_score}/100`} />
      </div>

      {u.tribes.length > 0 && <Tags title="Tribes" items={u.tribes} color="purple" />}
      {u.interests.length > 0 && <Tags title="Interests" items={u.interests} />}
      {u.looking_for.length > 0 && <Tags title="Looking for" items={u.looking_for} gold />}
      {u.position.length > 0 && <Tags title="Position" items={u.position} color="blue" />}
      {u.tag_codes.length > 0 && <Tags title="Tags" items={u.tag_codes} />}

      {/* compatibility */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Crown className="h-4 w-4 text-gold" /> Compatibility breakdown
        </h3>
        <div className="space-y-2.5">
          {Object.entries(u.dimensions).map(([k, v]) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-[11px] capitalize">
                <span className="text-muted">{k.replace(/([A-Z])/g, " $1")}</span>
                <span className="text-gold-soft">{v}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft" style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* icebreakers */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">AI icebreakers</h3>
          <button
            onClick={async () => {
              const r = await api<{ icebreakers: string[] }>("/api/ai", {
                method: "POST", body: { action: "icebreakers", targetId: u.id },
              });
              setIcebreakers(r.icebreakers);
            }}
            className="text-xs text-gold hover:text-gold-soft"
          >
            {icebreakers ? "Regenerate" : "Generate"}
          </button>
        </div>
        {icebreakers ? (
          <div className="space-y-2">
            {icebreakers.map((s, i) => (
              <button
                key={i}
                onClick={() => { navigator.clipboard?.writeText(s); pushToast("Copied!", "info"); }}
                className="w-full rounded-xl border border-line bg-surface-2 p-3 text-left text-sm text-white/80 hover:border-gold/30"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">Generate personalised openers based on {u.pseudo}&apos;s profile.</p>
        )}
      </div>

      {/* albums */}
      {(albums ?? []).filter((a) => a.type === "public").length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Public photos</h3>
          <div className="grid grid-cols-3 gap-2">
            {(albums ?? []).filter((a) => a.type === "public").flatMap((a) => a.photos).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.photo_url} alt="" className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-white/80">
      <span className="text-gold">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function Tags({ title, items, color, gold }: { title: string; items: string[]; color?: "purple" | "blue"; gold?: boolean }) {
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) =>
          gold ? (
            <span key={t} className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">{t}</span>
          ) : color ? (
            <Badge key={t} color={color}>{t}</Badge>
          ) : (
            <span key={t} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/80">{t}</span>
          )
        )}
      </div>
    </div>
  );
}
