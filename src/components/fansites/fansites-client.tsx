"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Users } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import { EmptyState, Skeleton, Button } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/avatar";

type Fansite = {
  id: string; name: string; description: string | null;
  cover_url: string | null; subscriber_count: number;
  owner: { id: string; pseudo: string; photos: string[]; verified: boolean; tier: string } | null;
};

export function FansitesClient() {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  const { data, isLoading } = useQuery({
    queryKey: ["fansites"],
    queryFn: () => api<{ fansites: Fansite[] }>("/api/social?view=fansites").then((r) => r.fansites),
  });

  const subscribe = useMutation({
    mutationFn: (fansiteId: string) =>
      api("/api/social", { method: "POST", body: { action: "subscribeFansite", fansiteId } }),
    onSuccess: () => {
      pushToast("Subscribed! You'll see their new posts first ⭐");
      qc.invalidateQueries({ queryKey: ["fansites"] });
    },
  });

  const fansites = data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Star className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Fansites</h1>
      </div>
      <p className="mb-5 text-sm text-muted">
        Subscribe to the kings whose content you love. Photoshoots, training logs, travel diaries.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : fansites.length === 0 ? (
        <EmptyState icon="⭐" title="No fansites yet" description="Top creators will show up here." />
      ) : (
        <div className="space-y-3">
          {fansites.map((f) => (
            <div key={f.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              {f.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.cover_url} alt={f.name} className="h-32 w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {f.owner && (
                    <Avatar name={f.owner.pseudo} photoUrl={f.owner.photos?.[0]} size={44} verified={f.owner.verified} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{f.name}</p>
                    {f.owner && <p className="text-xs text-muted">by {f.owner.pseudo}</p>}
                  </div>
                  <Button size="sm" onClick={() => subscribe.mutate(f.id)} disabled={subscribe.isPending}>
                    Subscribe
                  </Button>
                </div>
                {f.description && (
                  <p className="mt-2 text-xs leading-relaxed text-muted">{f.description}</p>
                )}
                <p className="mt-2 flex items-center gap-1 text-[11px] text-gold/70">
                  <Users className="h-3 w-3" /> {f.subscriber_count.toLocaleString()} subscribers
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
