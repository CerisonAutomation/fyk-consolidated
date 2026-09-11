"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, Zap, MessageCircle, Eye, CalendarDays, Sparkles, PawPrint, Crown, CheckCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { Notification } from "@/lib/types";
import { EmptyState, Skeleton, Button } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";

const ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  match: { icon: Crown, color: "text-gold" },
  tap: { icon: Zap, color: "text-gold-soft" },
  message: { icon: MessageCircle, color: "text-blue-400" },
  view: { icon: Eye, color: "text-purple-400" },
  like: { icon: Eye, color: "text-rose-400" },
  event: { icon: CalendarDays, color: "text-emerald-400" },
  ai: { icon: Sparkles, color: "text-gold" },
  pet: { icon: PawPrint, color: "text-amber-400" },
  system: { icon: Bell, color: "text-muted" },
};

export function NotificationsClient() {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api<{ notifications: Notification[]; unread: number }>("/api/notifications"),
  });

  const act = useMutation({
    mutationFn: (action: string) =>
      api("/api/notifications", { method: "POST", body: { action } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  const groups = items.reduce<Record<string, Notification[]>>((acc, n) => {
    const bucket = !n.read ? "New" : timeAgo(n.created_at).includes("h ago") ? "Earlier today" : "Older";
    (acc[bucket] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Bell className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Activity</h1>
        {unread > 0 && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-soft">
            {unread} new
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">
        Taps, matches, views and AI suggestions — all in one place.
      </p>

      {items.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => act.mutate("markAllRead")}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              act.mutate("clear");
              pushToast("Activity cleared", "info");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No activity yet"
          description="As you tap, match and chat, everything shows up here."
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([label, list]) => (
            <div key={label}>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted/70">
                {label}
              </p>
              <div className="space-y-2">
                {list.map((n) => {
                  const meta = ICONS[n.type] ?? ICONS.system;
                  const Icon = meta.icon;
                  const body = (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                        n.read
                          ? "border-line bg-surface/60"
                          : "border-gold/25 bg-gold/[0.06]"
                      )}
                    >
                      {n.actor ? (
                        <Avatar name={n.actor.pseudo} photoUrl={n.actor.photos?.[0]} size={42} online={n.actor.online} />
                      ) : (
                        <div className={cn("flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white/5", meta.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug text-white">{n.title}</p>
                          <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                        </div>
                        {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>}
                        {n.actor && (
                          <p className="mt-1 text-[11px] text-gold/70">
                            {n.actor.tribes.join(" · ") || n.actor.geo?.city}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                  return n.href ? (
                    <Link key={n.id} href={n.href} className="block">{body}</Link>
                  ) : (
                    <div key={n.id}>{body}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
