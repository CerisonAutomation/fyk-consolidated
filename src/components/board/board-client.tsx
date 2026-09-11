"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, Plus, X } from "lucide-react";
import { useState } from "react";
import { FYKMap } from "#/components/map/FYKMap";
import { getSupabase } from "#/integrations/supabase/client";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { ACTIVITIES } from "@/lib/activities";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BoardPost {
	id: string;
	userId: string;
	userName: string;
	userAge: number | null;
	userPhoto: string;
	status: "available" | "busy" | "away";
	activity: string;
	activityEmoji: string;
	note: string;
	liveUntil: string;
	tags: string[];
	joined: boolean;
	joinCount: number;
	createdAt: string;
}

interface BoardState {
	activityId: string;
	windowMinutes: number;
	note: string;
}

const FILTERS = [
	"Everything",
	"Open Invite",
	"Offering",
	"Looking For",
] as const;

function formatTimeRemaining(liveUntil: string): string {
	const now = new Date();
	const end = new Date(liveUntil);
	const diff = end.getTime() - now.getTime();
	if (diff <= 0) return "Ended";
	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
	if (hours > 0) return `${hours}h ${minutes}m left`;
	return `${minutes}m left`;
}
// ─── Component ───────────────────────────────────────────────────────────────

export function BoardClient() {
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);
	const { user: authUser } = useSupabaseSession();

	const [composing, setComposing] = useState(false);
	const [filter, setFilter] = useState<string>("Everything");
	const [viewMode, setViewMode] = useState<"list" | "map">("list");
	const [boardState, setBoardState] = useState<BoardState>({
		activityId: "coffee",
		windowMinutes: 120,
		note: "",
	});

	// ── Load posts from Supabase ──────────────────────────────────────────
	const { data: posts, isLoading } = useQuery({
		queryKey: ["board"],
		queryFn: async (): Promise<BoardPost[]> => {
			const sb = getSupabase();
			if (!sb || !authUser) return [];

			const now = new Date().toISOString();

			// 1. Fetch active (non-expired) posts
			const { data: rawPosts, error: pErr } = await sb
				.from("board_posts" as any)
				.select(
					"id, author_id, kind, body, activity_id, storage_path, city, area, spots, join_count, expires_at, created_at",
				)
				.gt("expires_at", now)
				.order("created_at", { ascending: false })
				.limit(60);

			if (pErr || !rawPosts || rawPosts.length === 0) return [];

			const postIds = rawPosts.map((p: any) => p.id as string);
			const authorIds = [
				...new Set(rawPosts.map((p: any) => p.author_id as string)),
			];

			// 2. Fetch authors, my joins in parallel
			const [authorsResult, joinsResult] = await Promise.all([
				sb
					.from("users")
					.select("id, pseudo, nick, age, photos, city, area")
					.in("id", authorIds),
				sb
					.from("post_joins" as any)
					.select("post_id, profile_id")
					.eq("profile_id", authUser.id)
					.in("post_id", postIds),
			]);

			const authorMap = new Map<string, any>();
			for (const a of authorsResult.data ?? []) {
				authorMap.set(a.id, a);
			}
			const myJoins = new Set<string>();
			for (const j of (joinsResult.data ?? []) as any[]) {
				myJoins.add(j.post_id);
			}

			// 3. Build view models
			return rawPosts.map((post: any) => {
				const author = authorMap.get(post.author_id);
				const activity = ACTIVITIES.find((a) => a.id === post.activity_id);
				const photo = author?.photos?.[0] ?? "";
				const tags: string[] = [];
				if (post.kind === "invite") tags.push("Open Invite");
				if (post.kind === "offer") tags.push("Offering");
				if (post.kind === "ask") tags.push("Looking For");
				if (post.spots && post.spots > 1) tags.push("Group");

				return {
					id: post.id,
					userId: post.author_id,
					userName: author?.nick ?? author?.pseudo ?? "Someone",
					userAge: author?.age ?? null,
					userPhoto: photo,
					status: "available" as const,
					activity: activity?.label ?? "Plan",
					activityEmoji: activity?.emoji ?? "\u2728",
					note: post.body,
					liveUntil: post.expires_at,
					tags,
					joined: myJoins.has(post.id),
					joinCount: post.join_count ?? 0,
					createdAt: post.created_at,
				};
			});
		},
		refetchInterval: 30_000,
	});

	// ── Join / leave post ──────────────────────────────────────────────────
	const joinPost = useMutation({
		mutationFn: async ({
			postId,
			joined,
		}: {
			postId: string;
			joined: boolean;
		}) => {
			const sb = getSupabase();
			if (!sb || !authUser) throw new Error("Not signed in");
			if (joined) {
				const { error } = await sb
					.from("post_joins" as any)
					.upsert({ post_id: postId, profile_id: authUser.id });
				if (error) throw error;
			} else {
				const { error } = await sb
					.from("post_joins" as any)
					.delete()
					.eq("post_id", postId)
					.eq("profile_id", authUser.id);
				if (error) throw error;
			}
		},
		onSuccess: () => {
			pushToast("Updated");
			qc.invalidateQueries({ queryKey: ["board"] });
		},
		onError: () => pushToast("Could not update, try again"),
	});

	// ── Create post ────────────────────────────────────────────────────────
	const createPost = useMutation({
		mutationFn: async () => {
			const sb = getSupabase();
			if (!sb || !authUser) throw new Error("Not signed in");

			const activity = ACTIVITIES.find((a) => a.id === boardState.activityId);
			const body =
				boardState.note.trim() || activity?.label || "Let's do something";
			const expiresInHours = Math.max(
				1,
				Math.round(boardState.windowMinutes / 60),
			);

			const { error } = await sb.from("board_posts" as any).insert({
				author_id: authUser.id,
				kind: "invite",
				body,
				activity_id: boardState.activityId,
				city: null,
				area: null,
				spots: null,
				join_count: 0,
				expires_at: new Date(
					Date.now() + expiresInHours * 3_600_000,
				).toISOString(),
			});
			if (error) throw error;
		},
		onSuccess: () => {
			setComposing(false);
			setBoardState((s) => ({ ...s, note: "" }));
			pushToast("Your plan is live");
			qc.invalidateQueries({ queryKey: ["board"] });
		},
		onError: () => pushToast("Could not post, try again"),
	});

	// ── Filtered view ──────────────────────────────────────────────────────
	const filteredPosts = (posts ?? []).filter((p) => {
		if (filter === "Open Invite") return !p.joined && p.joinCount < 2;
		if (filter === "Offering") return p.tags.includes("Offering");
		if (filter === "Looking For") return p.tags.includes("Looking For");
		return true;
	});

	// ── Render ─────────────────────────────────────────────────────────────
	return (
		<div className="mx-auto max-w-4xl px-4 py-6">
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-white">Board</h1>
				<p className="mt-1 text-sm text-white/60">
					Say what you're actually up for and for how long. Coffee, the beach, a
					controller, a lift to the airport, a date — all of it counts, none of
					it is permanent.
				</p>
			</div>

			{/* Filters */}
			<div className="mb-4 flex flex-wrap items-center gap-2">
				{FILTERS.map((f) => (
					<button
						key={f}
						onClick={() => setFilter(f)}
						className={cn(
							"rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
							filter === f
								? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
								: "border-white/20 bg-white/5 text-white/60 hover:text-white",
						)}
					>
						{f}
					</button>
				))}
				<button
					onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
					className={cn(
						"ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
						viewMode === "map"
							? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
							: "border-white/20 bg-white/5 text-white/60 hover:text-white",
					)}
				>
					<MapIcon className="h-4 w-4" />
					{viewMode === "map" ? "List" : "Map"}
				</button>
			</div>

			{/* Map View */}
			{viewMode === "map" ? (
				<FYKMap
					center={{ lat: 35.8989, lng: 14.5146 }}
					zoom={13}
					height={500}
					pins={(filteredPosts ?? []).map((post, i) => ({
						id: post.id,
						lat: 35.8989 + (i % 5) * 0.003 - 0.006,
						lng: 14.5146 + (i % 7) * 0.003 - 0.009,
						label: `${post.activityEmoji} ${post.activity} — ${post.userName}`,
						emoji: post.activityEmoji,
					}))}
					onSelect={(id) => {
						const post = filteredPosts?.find((p) => p.id === id);
						if (post)
							pushToast(
								`${post.activityEmoji} ${post.activity} by ${post.userName}`,
							);
					}}
				/>
			) : /* Posts Grid */
			isLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-64 rounded-2xl" />
					))}
				</div>
			) : filteredPosts.length === 0 ? (
				<EmptyState
					icon="📋"
					title="No plans right now"
					description="Be the first to post what you're up for today."
					action={
						<Button onClick={() => setComposing(true)}>
							<Plus className="h-3.5 w-3.5" /> Post a plan
						</Button>
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredPosts.map((post) => (
						<div
							key={post.id}
							className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20"
						>
							{/* LIVE Badge */}
							<div className="absolute left-3 top-3 z-10">
								<span className="flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-bold text-white">
									<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
									LIVE
								</span>
							</div>

							{/* Time Remaining */}
							<div className="absolute right-3 top-3 z-10">
								<span className="rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
									{formatTimeRemaining(post.liveUntil)}
								</span>
							</div>

							{/* User Photo or Activity Icon */}
							{post.userPhoto ? (
								<div className="relative h-48 overflow-hidden">
									<img
										src={post.userPhoto}
										alt={post.userName}
										className="h-full w-full object-cover transition-transform group-hover:scale-105"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
									<div className="absolute bottom-3 left-3 right-3">
										<p className="text-lg font-bold text-white">
											{post.userName}
											{post.userAge ? `, ${post.userAge}` : ""}
										</p>
										<p className="text-sm text-white/70">Online now</p>
									</div>
								</div>
							) : (
								<div className="flex h-32 items-center justify-center bg-white/5">
									<span className="text-4xl">{post.activityEmoji}</span>
								</div>
							)}

							{/* Activity & Tags */}
							<div className="p-4">
								<div className="mb-3 flex items-center gap-2">
									<span className="text-lg">{post.activityEmoji}</span>
									<span className="font-semibold text-white">
										{post.activity}
									</span>
								</div>

								{post.note && (
									<p className="mb-3 line-clamp-2 text-sm text-white/60">
										{post.note}
									</p>
								)}

								<div className="flex flex-wrap gap-1.5">
									{post.tags.map((tag) => (
										<span
											key={tag}
											className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
										>
											{tag}
										</span>
									))}
								</div>

								{/* Join Button */}
								<div className="mt-4 flex items-center justify-between">
									<span className="text-xs text-white/40">
										{post.joinCount}{" "}
										{post.joinCount === 1 ? "person" : "people"} joined
									</span>
									<Button
										onClick={() =>
											joinPost.mutate({ postId: post.id, joined: !post.joined })
										}
										disabled={joinPost.isPending}
										className={cn(
											"rounded-xl px-3 py-1.5 text-sm font-semibold",
											post.joined
												? "bg-white/10 text-white/40"
												: "bg-yellow-500 text-black hover:bg-yellow-400",
										)}
									>
										{post.joined ? "Joined" : "Join"}
									</Button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Compose Button (FAB) */}
			<div className="fixed bottom-24 right-6 z-40 lg:bottom-6">
				<button
					onClick={() => setComposing(true)}
					className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500 text-black shadow-lg transition-transform hover:scale-105 hover:bg-yellow-400"
				>
					<Plus className="h-6 w-6" />
				</button>
			</div>

			{/* Compose Modal */}
			{composing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-lg font-bold text-white">Post a plan</h2>
							<button
								onClick={() => setComposing(false)}
								className="text-white/40 hover:text-white"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						{/* Activity Selection */}
						<div className="mb-4">
							<label className="mb-2 block text-sm font-medium text-white/60">
								Activity
							</label>
							<div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
								{ACTIVITIES.filter((a) => !a.nsfw).map((a) => (
									<button
										key={a.id}
										onClick={() =>
											setBoardState((s) => ({ ...s, activityId: a.id }))
										}
										className={cn(
											"rounded-full border px-3 py-1.5 text-sm transition-colors",
											boardState.activityId === a.id
												? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
												: "border-white/20 bg-white/5 text-white/60 hover:text-white",
										)}
									>
										{a.emoji} {a.label}
									</button>
								))}
							</div>
						</div>

						{/* Window Selection */}
						<div className="mb-4">
							<label className="mb-2 block text-sm font-medium text-white/60">
								How long
							</label>
							<div className="flex flex-wrap gap-2">
								{[
									{ label: "1 hour", minutes: 60 },
									{ label: "2 hours", minutes: 120 },
									{ label: "4 hours", minutes: 240 },
									{ label: "Tonight", minutes: 420 },
									{ label: "All day", minutes: 720 },
								].map((w) => (
									<button
										key={w.minutes}
										onClick={() =>
											setBoardState((s) => ({ ...s, windowMinutes: w.minutes }))
										}
										className={cn(
											"rounded-full border px-3 py-1.5 text-sm transition-colors",
											boardState.windowMinutes === w.minutes
												? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
												: "border-white/20 bg-white/5 text-white/60 hover:text-white",
										)}
									>
										{w.label}
									</button>
								))}
							</div>
						</div>

						{/* Note */}
						<div className="mb-4">
							<label className="mb-2 block text-sm font-medium text-white/60">
								Note (optional)
							</label>
							<textarea
								value={boardState.note}
								onChange={(e) =>
									setBoardState((s) => ({ ...s, note: e.target.value }))
								}
								placeholder="What's the plan? Any details?"
								className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-yellow-500/50 focus:outline-none"
								rows={3}
								maxLength={400}
							/>
							<p className="mt-1 text-right text-xs text-white/30">
								{boardState.note.length}/400
							</p>
						</div>

						{/* Actions */}
						<div className="flex gap-3">
							<Button
								onClick={() => setComposing(false)}
								className="flex-1 rounded-xl border border-white/20 bg-transparent py-2.5 text-sm font-semibold text-white hover:bg-white/10"
							>
								Cancel
							</Button>
							<Button
								onClick={() => createPost.mutate()}
								disabled={createPost.isPending}
								className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-semibold text-black hover:bg-yellow-400"
							>
								{createPost.isPending ? "Posting..." : "Post plan"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
