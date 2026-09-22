import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Skeleton } from "@/components/ui/primitives";
import { api, ApiError, post } from "@/lib/client";
import { cn } from "@/lib/utils";

/**
 * `/vouches` — one member standing behind another's identity.
 *
 * WHAT WAS HERE
 * -------------
 * A generated list screen fetching `/api/vouches` and posting every card button to
 * `/api/vouches/{id}/action`. The endpoint did not exist and neither did the table
 * (`0033` added `public.vouches`), so the screen could only ever render the empty state
 * of a 404 — which reads as "no vouches yet", a plausible answer, which is why it
 * survived three audits.
 *
 * WHAT IT DOES
 * ------------
 * `#/routes/api/vouches` lists the vouches a profile has received, the ones you have
 * given, and lets you write one (20–500 characters, enforced by a database check as well
 * as the schema) or withdraw one you wrote. Withdrawal sets `revoked_at`: the row stays
 * so "did this person vouch for them, and when did they stop" remains answerable, and
 * it disappears from the profile at the same time.
 *
 * The author's verification level is shown next to each vouch, because a vouch from an
 * unverified account and one from somebody who passed the selfie challenge are not the
 * same claim — and the reader is the one who decides how much either is worth.
 */

interface VouchAuthor {
	id: string;
	handle: string | null;
	displayName: string | null;
	avatar: string | null;
	verification: number;
}

interface VouchItem {
	id: string;
	body: string;
	createdAt: string;
	revokedAt: string | null;
	profileId: string;
	author: VouchAuthor | null;
}

export const Route = createFileRoute("/vouches/")({
	component: VouchesScreen,
	validateSearch: (search: Record<string, unknown>): { userId?: string } => ({
		userId: typeof search.userId === "string" ? search.userId : undefined,
	}),
});

function VouchesScreen() {
	const { userId } = Route.useSearch();
	const qc = useQueryClient();
	const [tab, setTab] = useState<"received" | "given">("received");
	const [body, setBody] = useState("");
	const [note, setNote] = useState<string | null>(null);

	const query = new URLSearchParams({ view: tab });
	if (userId) query.set("profileId", userId);

	const vouches = useQuery({
		queryKey: ["vouches", tab, userId ?? ""],
		queryFn: () => api<{ items: VouchItem[]; total: number }>(`/api/vouches?${query}`),
	});

	const write = useMutation({
		mutationFn: (profileId: string) =>
			post<{ ok: boolean; id: string }>("/api/vouches", { profileId, body: body.trim() }),
		onSuccess: () => {
			setBody("");
			setNote("Vouch saved. Writing again edits it rather than adding a second one.");
			qc.invalidateQueries({ queryKey: ["vouches"] });
		},
		onError: (error) =>
			setNote(
				error instanceof ApiError || error instanceof Error
					? error.message
					: "That did not go through. Try again.",
			),
	});

	const revoke = useMutation({
		mutationFn: (id: string) =>
			api<{ ok: boolean }>(`/api/vouches?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
		onSuccess: () => {
			setNote("Withdrawn. The row stays on record with the date you withdrew it.");
			qc.invalidateQueries({ queryKey: ["vouches"] });
		},
		onError: (error) => setNote(error instanceof Error ? error.message : "Could not withdraw."),
	});

	const items = vouches.data?.items ?? [];

	return (
		<div className="mx-auto max-w-2xl p-4 pb-24">
			<h1 className="font-display text-[24px] font-bold tracking-tight text-black">
				Vouches
			</h1>
			<p className="mt-1 text-[14px] text-zinc-500">
				A vouch is a named member saying, in writing, that they know you are who you say
				you are.
			</p>

			{userId && (
				<div className="mt-4 rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm">
					<h2 className="text-[14px] font-medium text-black">Write a vouch</h2>
					<p className="mt-1 text-[12px] text-zinc-500">
						Twenty characters at least, five hundred at most. It appears on their
						profile with your name and verification badge.
					</p>
					<textarea
						value={body}
						rows={3}
						maxLength={500}
						onChange={(event) => setBody(event.target.value)}
						placeholder="How you know them, and what you can say about who they are."
						className="mt-2 w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black"
					/>
					<div className="mt-2 flex items-center justify-between">
						<span className="text-[11px] text-zinc-400">{body.trim().length}/500</span>
						<Button
							type="button"
							onClick={() => write.mutate(userId)}
							disabled={write.isPending || body.trim().length < 20}
							className="rounded-full bg-black px-4 py-1.5 text-[12px] text-white disabled:opacity-60"
						>
							{write.isPending ? "Saving…" : "Publish vouch"}
						</Button>
					</div>
				</div>
			)}

			{note && (
				<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
					{note}
				</output>
			)}

			{!userId && (
				<div className="mt-4 flex gap-2">
					{(["received", "given"] as const).map((name) => (
						<button
							key={name}
							type="button"
							onClick={() => setTab(name)}
							className={cn(
								"rounded-full border px-3 py-1.5 text-[13px]",
								tab === name
									? "border-black bg-black text-white"
									: "border-zinc-200 bg-white text-zinc-600",
							)}
						>
							{name === "received" ? "About me" : "Written by me"}
						</button>
					))}
				</div>
			)}

			{vouches.isLoading ? (
				<div className="mt-6 space-y-3">
					{[0, 1].map((row) => (
						<Skeleton key={`vouch-skeleton-${row}`} className="h-24 rounded-[16px]" />
					))}
				</div>
			) : items.length === 0 ? (
				<div className="mt-6 rounded-[16px] border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
					<ShieldCheck className="mx-auto h-6 w-6 text-zinc-400" />
					<p className="mt-2 text-[14px] font-medium text-zinc-700">
						{tab === "given" ? "You have not vouched for anyone" : "No vouches yet"}
					</p>
					<p className="mt-1 text-[12px] text-zinc-500">
						{tab === "given" ? (
							<>
								Open a profile and choose Vouch, or{" "}
								<Link to="/favorites" className="underline">
									start from favourites
								</Link>
								.
							</>
						) : (
							"Vouches come from people who know you. They cannot be requested from here."
						)}
					</p>
				</div>
			) : (
				<div className="mt-6 space-y-3">
					{items.map((item) => (
						<div
							key={item.id}
							className={cn(
								"rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm",
								item.revokedAt && "opacity-60",
							)}
						>
							<div className="flex items-center gap-2">
								{item.author?.avatar ? (
									<img
										src={item.author.avatar}
										alt=""
										className="h-8 w-8 rounded-full object-cover"
									/>
								) : (
									<div className="h-8 w-8 rounded-full bg-zinc-200" />
								)}
								<div className="min-w-0">
									<p className="flex items-center gap-1 text-[13px] font-medium text-black">
										{item.author?.displayName ?? item.author?.handle ?? "Member"}
										{(item.author?.verification ?? 0) >= 2 && (
											<BadgeCheck className="h-3.5 w-3.5 text-sky-500" />
										)}
									</p>
									<p className="text-[11px] text-zinc-400">
										{new Date(item.createdAt).toLocaleDateString()}
										{item.revokedAt
											? ` • withdrawn ${new Date(item.revokedAt).toLocaleDateString()}`
											: ""}
									</p>
								</div>
								{tab === "given" && !item.revokedAt && (
									<button
										type="button"
										onClick={() => revoke.mutate(item.id)}
										disabled={revoke.isPending}
										className="ml-auto flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 disabled:opacity-60"
									>
										<Trash2 className="h-3 w-3" />
										Withdraw
									</button>
								)}
							</div>
							<p className="mt-2 text-[13px] leading-relaxed text-zinc-700">{item.body}</p>
						</div>
					))}
				</div>
			)}

			<p className="mt-6 text-[11px] text-zinc-500">
				Reads <code>GET /api/vouches</code>; writes <code>POST /api/vouches</code> and
				withdraws with <code>DELETE /api/vouches?id=</code>. One vouch per person: writing
				again edits the one you already wrote.
			</p>
		</div>
	);
}
