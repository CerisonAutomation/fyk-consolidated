import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Target } from "lucide-react";
import { Button, Skeleton } from "@/components/ui/primitives";
import { api, post } from "@/lib/client";

/**
 * `/community-challenges` — the goals, the progress and the reward.
 *
 * WHAT WAS HERE
 * -------------
 * A generated list screen fetching `/api/community-challenges` and posting every card
 * button to `/api/community-challenges/{id}/action`. Neither path existed, so the screen
 * could only render the empty state of a request that 404s. The only counter the product
 * could show came from `/api/growth/streak`, which built its input from three invented
 * timestamps.
 *
 * WHAT IT READS NOW
 * -----------------
 * `#/routes/api/growth/challenges` over `challenges` and `challenge_participants`
 * (`0033`). Progress is computed on read from the table the goal names — sign-in days,
 * profile completeness, RSVPs, group membership — which is why the bar can go *down*:
 * cancelling an RSVP un-finishes an events goal, and that is the honest number. Each
 * challenge states its own source, so a bar is never a number with no account behind it.
 *
 * Claiming posts the reward through the ledger with `challenge:<id>:<user>` as its
 * idempotency key, so claiming from two devices credits one reward and the second attempt
 * is answered with "already claimed".
 */

interface ChallengeItem {
	id: string;
	slug: string;
	title: string;
	description: string;
	kind: string;
	targetCount: number;
	rewardBones: number;
	endsAt: string;
	joined: boolean;
	progress: number;
	complete: boolean;
	rewardClaimedAt: string | null;
	source: string;
}

export const Route = createFileRoute("/community-challenges/")({
	component: CommunityChallengesScreen,
});

function CommunityChallengesScreen() {
	const qc = useQueryClient();

	const challenges = useQuery({
		queryKey: ["challenges"],
		queryFn: () => api<{ items: ChallengeItem[]; total: number }>("/api/growth/challenges"),
	});

	const act = useMutation({
		mutationFn: (input: { action: "join" | "claim"; challengeId: string }) =>
			post<{ ok: boolean; balance?: number | null }>("/api/growth/challenges", input),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
	});

	if (challenges.isLoading) {
		return (
			<div className="mx-auto max-w-2xl space-y-3 p-4 pb-24">
				<Skeleton className="h-8 w-56 rounded-[12px]" />
				{[0, 1, 2].map((row) => (
					<Skeleton key={`challenge-skeleton-${row}`} className="h-28 rounded-[16px]" />
				))}
			</div>
		);
	}

	const items = challenges.data?.items ?? [];

	return (
		<div className="mx-auto max-w-2xl p-4 pb-24">
			<h1 className="font-display text-[24px] font-bold tracking-tight text-black">
				Community challenges
			</h1>
			<p className="mt-1 text-[14px] text-zinc-500">
				Goals that pay in bones. Progress is read from the thing it counts, every time
				you open this screen.
			</p>

			{act.isError && (
				<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
					{act.error instanceof Error ? act.error.message : "That did not go through."}
				</output>
			)}

			{act.isSuccess && act.data?.balance !== undefined && act.data?.balance !== null && (
				<output className="mt-4 block rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
					Reward paid. Balance: {act.data.balance} bones.
				</output>
			)}

			{items.length === 0 ? (
				<div className="mt-6 rounded-[16px] border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
					<Target className="mx-auto h-6 w-6 text-zinc-400" />
					<p className="mt-2 text-[14px] font-medium text-zinc-700">
						No challenges are running
					</p>
					<p className="mt-1 text-[12px] text-zinc-500">
						They are authored in the database — `supabase/migrations/0033` seeds the
						first four — and appear here while their window is open.
					</p>
				</div>
			) : (
				<div className="mt-6 space-y-3">
					{items.map((item) => {
						const percent = Math.round(
							(item.progress / Math.max(1, item.targetCount)) * 100,
						);
						return (
							<div
								key={item.id}
								className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="font-medium text-black">{item.title}</p>
										<p className="mt-1 text-[13px] text-zinc-500">{item.description}</p>
									</div>
									<div className="shrink-0 text-right">
										<p className="flex items-center gap-1 text-[13px] font-medium text-amber-700">
											<Award className="h-4 w-4" />
											{item.rewardBones} bones
										</p>
										<p className="mt-0.5 text-[11px] text-zinc-400">
											ends {new Date(item.endsAt).toLocaleDateString()}
										</p>
									</div>
								</div>

								<div className="mt-3">
									<div className="h-2 overflow-hidden rounded-full bg-zinc-100">
										<div
											className={`h-full rounded-full ${
												item.complete ? "bg-emerald-500" : "bg-black"
											}`}
											style={{ width: `${Math.min(100, percent)}%` }}
										/>
									</div>
									<p className="mt-1.5 text-[11px] text-zinc-500">
										{item.progress} of {item.targetCount} — {item.source}
									</p>
								</div>

								<div className="mt-3 flex flex-wrap items-center gap-2">
									{!item.joined && (
										<Button
											type="button"
											onClick={() => act.mutate({ action: "join", challengeId: item.id })}
											disabled={act.isPending}
											className="rounded-full bg-black px-3 py-1.5 text-[12px] text-white disabled:opacity-60"
										>
											Join
										</Button>
									)}
									{item.joined && !item.rewardClaimedAt && (
										<Button
											type="button"
											onClick={() =>
												act.mutate({ action: "claim", challengeId: item.id })
											}
											disabled={!item.complete || act.isPending}
											className="rounded-full bg-black px-3 py-1.5 text-[12px] text-white disabled:opacity-60"
										>
											{item.complete ? "Claim reward" : "In progress"}
										</Button>
									)}
									{item.rewardClaimedAt && (
										<span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-700">
											Claimed
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			<p className="mt-6 text-[11px] text-zinc-500">
				Reads <code>GET /api/growth/challenges</code>; joins and claims through{" "}
				<code>POST /api/growth/challenges</code>.
			</p>
		</div>
	);
}
