"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star, Users, Plus } from "lucide-react";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import {
  listFansites,
  toggleFansiteSubscription,
  createFansite,
} from "#/integrations/supabase/fansites";
import { useAppStore } from "@/lib/store";
import { EmptyState, Skeleton, Button } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/avatar";

// ─── Create Fansite Form ─────────────────────────────────────────────────────

function CreateFansiteForm({ onDone }: { onDone: () => void }) {
  const { user } = useSupabaseSession();
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createFansite(user?.id, { name, description: description || undefined }),
    onSuccess: (result) => {
      if (result.ok) {
        pushToast("Fansite created!", "success");
        qc.invalidateQueries({ queryKey: ["fansites"] });
        onDone();
      } else {
        pushToast(result.message, "error");
      }
    },
  });

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-sm font-bold text-white">Create Your Fansite</h3>
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fansite name"
          className="w-full rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-white placeholder:text-muted focus:border-gold/50 focus:outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What will you share? (optional)"
          rows={2}
          className="w-full resize-none rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-white placeholder:text-muted focus:border-gold/50 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onDone}
          className="rounded-xl border border-line px-3 py-2 text-xs text-muted hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || createMutation.isPending}
          className="rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "Create Fansite"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FansitesClient() {
  const { user } = useSupabaseSession();
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["fansites"],
    queryFn: () =>
      user ? listFansites(user.id).then((r) => (r.ok ? r.data : [])) : Promise.resolve([]),
    enabled: !!user,
  });

  const subscribe = useMutation({
    mutationFn: (fansiteId: string) =>
      toggleFansiteSubscription(fansiteId, user?.id),
    onSuccess: (result) => {
      if (result.ok) {
        pushToast(
          result.data.subscribed
            ? "Subscribed! You'll see their new posts first."
            : "Unsubscribed",
          result.data.subscribed ? "success" : "info",
        );
        qc.invalidateQueries({ queryKey: ["fansites"] });
      } else {
        pushToast(result.message, "error");
      }
    },
  });

  const fansites = data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-gold" />
          <h1 className="text-xl font-bold text-white">Fansites</h1>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 rounded-xl bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Fansite
        </button>
      </div>
      <p className="mb-5 text-sm text-muted">
        Subscribe to the kings whose content you love. Photoshoots, training logs, travel diaries.
      </p>

      {showCreate && (
        <div className="mb-4">
          <CreateFansiteForm onDone={() => setShowCreate(false)} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : fansites.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No fansites yet"
          description="Top creators will show up here."
        />
      ) : (
        <div className="space-y-3">
          {fansites.map((f) => {
            const ownerName = f.owner?.pseudo ?? f.owner?.nick ?? "Anonymous";
            const ownerPhotos = f.owner?.photos;
            const firstPhoto = Array.isArray(ownerPhotos) && ownerPhotos.length > 0 ? ownerPhotos[0] : undefined;

            return (
              <div
                key={f.id}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
              >
                {f.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.cover_url}
                    alt={f.name}
                    className="h-32 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {f.owner && (
                      <Avatar
                        name={ownerName}
                        photoUrl={firstPhoto}
                        size={44}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {f.name}
                      </p>
                      {f.owner && (
                        <p className="text-xs text-muted">
                          by {ownerName}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => subscribe.mutate(f.id)}
                      disabled={subscribe.isPending}
                      variant={f.is_subscribed ? "secondary" : "primary"}
                    >
                      {f.is_subscribed ? "Subscribed" : "Subscribe"}
                    </Button>
                  </div>
                  {f.description && (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      {f.description}
                    </p>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-gold/70">
                    <Users className="h-3 w-3" />{" "}
                    {f.subscriber_count.toLocaleString()} subscribers
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
