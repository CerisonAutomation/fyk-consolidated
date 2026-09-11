"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Ban, Flag, Lock, Eye, Smartphone, X, Heart, Zap, FileLock2, Handshake, Moon,
} from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { ProfileUser, NoteItem, Footprint } from "@/lib/types";
import { EmptyState, Skeleton, Button } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";

type BlockedUser = { user: ProfileUser; reason: string | null };

const TIPS = [
  { icon: Lock, title: "Keep it on-platform", desc: "Chat on FYK until you genuinely trust someone. Off-platform requests in the first few messages are a scam signal." },
  { icon: Eye, title: "Video verify first", desc: "Look for the ✓ verified badge and suggest a quick video call before meeting in person." },
  { icon: Smartphone, title: "Meet in public", desc: "First meetings belong in busy public places. Share your live location with a friend." },
  { icon: Flag, title: "Report anything", desc: "If something feels off, report it. Our moderation mesh reviews reports around the clock." },
  { icon: FileLock2, title: "Consent media rails", desc: "Explicit media requires both people to opt in first. Every image is watermarked and revocable." },
  { icon: Handshake, title: "Set the pact early", desc: "Agree on what you're both looking for inside the chat — before expectations mismatch." },
];

const PRESET_META: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  visited: { label: "Viewed your profile", icon: Eye, color: "text-purple-400" },
  liked: { label: "Favorited you", icon: Heart, color: "text-rose-400" },
  tapped: { label: "Tapped you", icon: Zap, color: "text-gold-soft" },
};

export function SafetyClient() {
  const qc = useQueryClient();
  const router = useRouter();
  const pushToast = useAppStore((s) => s.pushToast);
  const me = useAppStore((s) => s.user);
  const [tab, setTab] = useState<"viewed" | "blocked" | "notes">("viewed");
  const [noteTarget, setNoteTarget] = useState<ProfileUser | null>(null);
  const [noteContent, setNoteContent] = useState("");

  const { data: footprints, isLoading: loadingFp } = useQuery({
    queryKey: ["footprints"],
    queryFn: () =>
      api<{ footprints: Footprint[] }>("/api/social?view=footprints").then((r) => r.footprints),
  });

  const { data: blocked, isLoading: loadingBlocked } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api<{ blocked: BlockedUser[] }>("/api/blocks").then((r) => r.blocked),
  });

  const { data: notes, isLoading: loadingNotes } = useQuery({
    queryKey: ["notes"],
    queryFn: () => api<{ notes: NoteItem[] }>("/api/notes").then((r) => r.notes),
  });

  const unblock = useMutation({
    mutationFn: (targetId: string) =>
      api("/api/blocks", { method: "DELETE", body: { targetId } }),
    onSuccess: () => {
      pushToast("User unblocked", "info");
      qc.invalidateQueries({ queryKey: ["blocks"] });
      qc.invalidateQueries({ queryKey: ["discover"] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: (targetId: string) =>
      api("/api/notes", { method: "DELETE", body: { targetId } }),
    onSuccess: () => {
      pushToast("Note deleted", "info");
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const saveNote = useMutation({
    mutationFn: () =>
      api("/api/notes", { method: "POST", body: { targetId: noteTarget!.id, content: noteContent } }),
    onSuccess: () => {
      pushToast("Note saved 📝");
      setNoteTarget(null); setNoteContent("");
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const isIncognito = me?.incognito ?? false;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Shield className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Safety Center</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        Your safety is non-negotiable. Manage visibility, blocks and private notes.
      </p>

      {/* incognito status */}
      {isIncognito && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3">
          <Moon className="h-4 w-4 shrink-0 text-purple-300" />
          <p className="text-xs text-white/85">
            <span className="font-semibold text-purple-200">Incognito is on.</span> You browse without
            appearing in anyone&apos;s footprints or grid.
          </p>
        </div>
      )}

      {/* tips */}
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {TIPS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.title} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">{t.title}</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{t.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* tabs */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {([
          ["viewed", `Who viewed (${footprints?.length ?? 0})`],
          ["blocked", `Blocked (${blocked?.length ?? 0})`],
          ["notes", `Notes (${notes?.length ?? 0})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors",
              tab === k ? "bg-gold text-ink" : "text-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "viewed" ? (
        loadingFp ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : !footprints?.length ? (
          <EmptyState icon="👀" title="No profile views yet" description="As people discover you, views show up here (Gold feature)." />
        ) : (
          <div className="space-y-2">
            {footprints.map((f, i) => {
              const meta = PRESET_META[f.preset] ?? PRESET_META.visited;
              const Icon = meta.icon;
              return (
                <button
                  key={`${f.user.id}-${i}`}
                  onClick={() => router.push(`/profile/${f.user.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:border-gold/30"
                >
                  <Avatar name={f.user.pseudo} photoUrl={f.user.photos?.[0]} size={44} online={f.user.online} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{f.user.pseudo}</p>
                    <p className={cn("flex items-center gap-1 text-[11px]", meta.color)}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{timeAgo(f.visited_at)}</span>
                </button>
              );
            })}
          </div>
        )
      ) : tab === "blocked" ? (
        loadingBlocked ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : !blocked?.length ? (
          <EmptyState icon="🚫" title="No blocked users" description="Block anyone from their profile — instantly and silently." />
        ) : (
          <div className="space-y-2">
            {blocked.map((b) => (
              <div key={b.user.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <Avatar name={b.user.pseudo} photoUrl={b.user.photos?.[0]} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{b.user.pseudo}</p>
                  {b.reason && <p className="truncate text-[11px] text-muted capitalize">Reason: {b.reason}</p>}
                </div>
                <Button variant="secondary" size="sm" onClick={() => unblock.mutate(b.user.id)}>
                  <Ban className="h-3.5 w-3.5" /> Unblock
                </Button>
              </div>
            ))}
          </div>
        )
      ) : loadingNotes ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : !notes?.length ? (
        <EmptyState icon="📝" title="No private notes" description="Jot down reminders about people you meet — only you ever see these." />
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
              <Avatar name={n.target.pseudo} photoUrl={n.target.photos?.[0]} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{n.target.pseudo}</p>
                  <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-white/80">{n.content}</p>
              </div>
              <button onClick={() => deleteNote.mutate(n.target.id)} className="text-muted hover:text-rose-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {noteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" onClick={() => setNoteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={noteTarget.pseudo} photoUrl={noteTarget.photos?.[0]} size={40} />
              <p className="text-sm font-semibold text-white">Note about {noteTarget.pseudo}</p>
            </div>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="Private note (only you can see it)…"
              className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => saveNote.mutate()} disabled={!noteContent.trim()} className="flex-1">Save note</Button>
              <Button variant="secondary" onClick={() => setNoteTarget(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
