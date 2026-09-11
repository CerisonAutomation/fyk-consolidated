"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Check, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { GroupItem } from "@/lib/types";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { cn, gradient } from "@/lib/utils";

export function GroupsClient() {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  const { data, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () =>
      api<{ groups: GroupItem[] }>("/api/groups").then((r) => r.groups),
  });

  const joinMutation = useMutation({
    mutationFn: ({ groupId, action }: { groupId: string; action: "join" | "leave" }) =>
      api("/api/groups", { method: "POST", body: { groupId, action } }),
    onSuccess: (_, vars) => {
      pushToast(vars.action === "join" ? "Joined group 🎉" : "Left group", vars.action === "join" ? "success" : "info");
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const groups = data || [];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Groups</h1>
      </div>
      <p className="mb-5 text-sm text-muted">
        Find your tribe. Join communities based on shared interests.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No groups yet"
          description="Be the first to start a community."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-gold/30"
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                style={{ background: gradient(g.name) }}
              >
                {g.icon || "👥"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-white">
                  {g.name}
                </h3>
                <p className="line-clamp-1 text-xs text-muted">{g.description}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <Users className="h-3 w-3" />
                  {(g.member_count || 0).toLocaleString()} members
                </p>
              </div>
              <button
                onClick={() =>
                  joinMutation.mutate({
                    groupId: g.id,
                    action: g.joined ? "leave" : "join",
                  })
                }
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors",
                  g.joined
                    ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "bg-gold text-ink hover:bg-gold-soft"
                )}
              >
                {g.joined ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Joined
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Join
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
