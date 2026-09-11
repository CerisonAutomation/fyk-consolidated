"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Zap, Clock, X } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { MeetNowPost } from "@/lib/types";
import { EmptyState, Skeleton, Button } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";
import { MEETNOW } from "@/lib/constants";

const CAT_EMOJI: Record<string, string> = {
  Gym: "🏋️", Dinner: "🍽️", Coffee: "☕", Party: "🎉",
  Movies: "🎬", Walk: "🚶", Travel: "✈️", Other: "✨",
};

export function MeetNowClient() {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState("Coffee");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["meetnow"],
    queryFn: () => api<{ posts: MeetNowPost[] }>("/api/meetnow").then((r) => r.posts),
    refetchInterval: 60000,
  });

  const join = useMutation({
    mutationFn: (postId: string) =>
      api("/api/meetnow", { method: "POST", body: { action: "join", postId } }),
    onSuccess: () => {
      pushToast("Joined! They've been notified ⚡");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const post = useMutation({
    mutationFn: () =>
      api("/api/meetnow", { method: "POST", body: { category, note } }),
    onSuccess: () => {
      setComposing(false); setNote("");
      pushToast("Your plan is live for 4 hours 🎯");
      qc.invalidateQueries({ queryKey: ["meetnow"] });
    },
  });

  const posts = data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Meet Now</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        Spontaneous plans expiring in hours. Say yes before it&apos;s gone.
      </p>

      <button
        onClick={() => setComposing(true)}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-gold/[0.06] p-4 text-left transition-colors hover:border-gold/60"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Zap className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Post a spontaneous plan</p>
          <p className="text-xs text-muted">Gym partner, coffee run, dinner date — live for 4 hours</p>
        </div>
      </button>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon="⚡" title="No active plans" description="Be the first to post — spontaneous is the whole point." />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const minsLeft = Math.max(0, Math.round((new Date(p.expires_at).getTime() - Date.now()) / 60000));
            return (
              <div key={p.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={p.user.pseudo} photoUrl={p.user.photos?.[0]} size={44} online={p.user.online} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{p.user.pseudo}</p>
                      {p.user.verified && <span className="text-xs text-gold">✓</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-muted">{timeAgo(p.created_at)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold-soft">
                        {CAT_EMOJI[p.category] ?? "✨"} {p.category}
                      </span>
                      {p.location && (
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <MapPin className="h-3 w-3" /> {p.location}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/90">{p.note}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={cn(
                    "flex items-center gap-1 text-[11px]",
                    minsLeft < 60 ? "text-rose-400" : "text-muted"
                  )}>
                    <Clock className="h-3 w-3" /> {minsLeft < 60 ? `${minsLeft}m left` : `${Math.round(minsLeft / 60)}h left`}
                  </span>
                  <Button size="sm" className="ml-auto" onClick={() => join.mutate(p.id)} disabled={join.isPending}>
                    <Zap className="h-3.5 w-3.5" /> I&apos;m in
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {composing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 p-0 sm:items-center sm:p-4" onClick={() => setComposing(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Post a plan</h3>
              <button onClick={() => setComposing(false)} className="text-muted hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-3 text-xs text-muted">Pick a category and describe the plan. Goes live for 4 hours.</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {MEETNOW.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    category === c ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line bg-surface-2 text-muted hover:text-white"
                  )}
                >
                  {CAT_EMOJI[c]} {c}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Grabbing coffee in Chelsea in 30 — join me?"
              className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            <Button className="mt-3 w-full" onClick={() => post.mutate()} disabled={!note.trim() || post.isPending}>
              Post plan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
