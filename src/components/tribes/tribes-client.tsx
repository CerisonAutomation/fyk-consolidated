"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Globe } from "lucide-react";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import {
	listTribes,
	MAX_TRIBES,
	toggleTribe,
} from "#/integrations/supabase/tribes";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useAppStore } from "@/lib/store";
import { cn, gradient } from "@/lib/utils";

export function TribesClient() {
	const { user } = useSupabaseSession();
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);

	const { data, isLoading } = useQuery({
		queryKey: ["tribes"],
		queryFn: () =>
			user
				? listTribes(user.id).then((r) => (r.ok ? r.data : []))
				: Promise.resolve([]),
		enabled: !!user,
	});

	const toggle = useMutation({
		mutationFn: ({ name, join }: { name: string; join: boolean }) =>
			toggleTribe(name, user?.id, join),
		onSuccess: (result, vars) => {
			if (result.ok) {
				pushToast(
					vars.join ? `You're now ${vars.name}!` : `Removed ${vars.name}`,
					vars.join ? "success" : "info",
				);
			} else {
				pushToast(result.message, "error");
			}
			qc.invalidateQueries({ queryKey: ["tribes"] });
		},
		onError: (e) =>
			pushToast(e instanceof Error ? e.message : "Failed", "error"),
	});

	const tribes = data ?? [];
	const joinedCount = tribes.filter((t) => t.joined).length;

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-2 flex items-center gap-2">
				<Globe className="h-5 w-5 text-gold" />
				<h1 className="text-xl font-bold text-white">Tribes</h1>
			</div>
			<p className="mb-4 text-sm text-muted">
				Your community within the community. Pick up to {MAX_TRIBES} — it powers
				your matches.
			</p>

			{joinedCount > 0 && (
				<div className="mb-4 rounded-2xl border border-gold/25 bg-gold/[0.06] p-3">
					<p className="text-xs text-white/80">
						<span className="font-semibold text-gold-soft">
							{joinedCount} of {MAX_TRIBES} tribes selected.
						</span>{" "}
						Your primary tribe drives your discovery ranking.
					</p>
				</div>
			)}

			{isLoading ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{Array.from({ length: 8 }).map((_, i) => (
						<Skeleton key={i} className="h-28 rounded-2xl" />
					))}
				</div>
			) : tribes.length === 0 ? (
				<EmptyState icon="🌍" title="No tribes yet" />
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{tribes.map((t) => (
						<button
							key={t.id}
							onClick={() => toggle.mutate({ name: t.name, join: !t.joined })}
							disabled={toggle.isPending}
							className={cn(
								"flex items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5",
								t.joined
									? "border-gold/45 bg-gold/[0.08]"
									: "border-line bg-surface hover:border-gold/30",
							)}
						>
							<div
								className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
								style={{ background: gradient(t.name) }}
							>
								{t.icon ?? "🌍"}
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold text-white">
									{t.name}
								</p>
								<p className="line-clamp-2 text-xs text-muted">
									{t.description}
								</p>
								<p className="mt-1 text-[11px] text-gold/70">
									{t.member_count.toLocaleString()} members
								</p>
							</div>
							{t.joined && (
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
									<Check className="h-3.5 w-3.5" strokeWidth={3} />
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
