"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Send, Heart, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { Shout, ProfileUser } from "@/lib/types";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";

export function ShoutsClient() {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const me = useAppStore((s) => s.user);
  const [content, setContent] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["shouts"],
    queryFn: () => api<{ shouts: Shout[] }>("/api/social?view=shouts").then((r) => r.shouts),
    refetchInterval: 30000,
  });

  const post = useMutation({
    mutationFn: () => api("/api/social", { method: "POST", body: { action: "shout", content } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["shouts"] });
      const prev = qc.getQueryData<{ shouts: Shout[] }>(["shouts"]);
      if (prev && me) {
        qc.setQueryData(["shouts"], {
          shouts: [
            {
              id: `temp-${Date.now()}`,
              content: content.trim(),
              likes_count: 0, liked: false,
              created_at: new Date().toISOString(),
              author: me,
            },
            ...prev.shouts,
          ],
        });
      }
      setContent("");
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["shouts"], ctx.prev);
      pushToast("Could not post — try again", "error");
    },
    onSuccess: () => {
      pushToast("Shout posted 📣");
      qc.invalidateQueries({ queryKey: ["shouts"] });
    },
  });

  const like = useMutation({
    mutationFn: (shoutId: string) =>
      api<{ liked: boolean }>("/api/social", { method: "POST", body: { action: "likeShout", shoutId } }),
    onMutate: async (shoutId) => {
      await qc.cancelQueries({ queryKey: ["shouts"] });
      const prev = qc.getQueryData<{ shouts: Shout[] }>(["shouts"]);
      if (prev) {
        qc.setQueryData(["shouts"], {
          shouts: prev.shouts.map((s) =>
            s.id === shoutId
              ? { ...s, liked: !s.liked, likes_count: s.likes_count + (s.liked ? -1 : 1) }
              : s
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["shouts"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shouts"] }),
  });

  const shouts = data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Shouts</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        The community feed. Wins, questions, chaos — all welcome.
      </p>

      {/* composer */}
      <div className="mb-5 rounded-2xl border border-line bg-surface p-3">
        <div className="flex gap-3">
          <Avatar name={me?.pseudo ?? "You"} photoUrl={me?.photos?.[0]} size={40} />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind, king?"
            rows={2}
            maxLength={280}
            className="flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className={cn("text-[11px]", content.length > 240 ? "text-rose-400" : "text-muted")}>
            {content.length}/280
          </span>
          <button
            onClick={() => post.mutate()}
            disabled={!content.trim() || post.isPending}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
          >
            {post.isPending ? <Spinner className="border-ink/40 border-t-ink" /> : <Send className="h-4 w-4" />}
            Shout
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : shouts.length === 0 ? (
        <EmptyState icon="📣" title="No shouts yet" description="Be the first to break the silence." />
      ) : (
        <div className="space-y-3">
          {shouts.filter((s): s is Shout & { author: ProfileUser } => !!s.author).map((s) => (
            <div key={s.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-3">
                <Avatar name={s.author.pseudo} photoUrl={s.author.photos?.[0]} size={40} online={s.author.online} />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white">{s.author.pseudo}</p>
                    {s.author.verified && <Sparkles className="h-3 w-3 text-gold" />}
                  </div>
                  <p className="text-[11px] text-muted">
                    {timeAgo(s.created_at)} · {s.author.tribes.slice(0, 2).join(" / ") || s.author.geo?.city}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/90">{s.content}</p>
              <button
                onClick={() => like.mutate(s.id)}
                className={cn(
                  "mt-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                  s.liked ? "bg-rose-500/15 text-rose-400" : "text-muted hover:bg-white/5 hover:text-rose-400"
                )}
              >
                <Heart className={cn("h-4 w-4", s.liked && "fill-rose-400")} />
                {s.likes_count}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
