"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Megaphone, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Avatar } from "#/components/ui/Avatar";
import {
	createShout,
	listShouts,
	type ShoutAuthor,
	type ShoutItem,
	toggleShoutLike,
} from "#/integrations/supabase/shouts";
import { useAuth } from "@/components/EntryShell";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/primitives";
import { useAppStore } from "@/lib/store";
import { cn, timeAgo } from "@/lib/utils";

/** Map a ShoutAuthor to the display shape the component expects. */
function authorDisplay(a: ShoutAuthor | null) {
	if (!a) return null;
	return {
		pseudo: a.display_name || "Anonymous",
		photos: a.avatar_url ? [a.avatar_url] : [],
		online:
			!a.hide_online &&
			Date.now() - new Date(a.last_active_at).getTime() < 5 * 60_000,
		tribes: [] as string[],
		geo: a.city ? { city: a.city } : undefined,
		verified: a.verified,
	};
}

export function ShoutsClient() {
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);
	const { user } = useAuth();
	const [content, setContent] = useState("");

	const userId = user?.id ?? "";

	const { data, isLoading } = useQuery({
		queryKey: ["shouts"],
		queryFn: () => listShouts(userId).then((r) => (r.ok ? r.data : [])),
		refetchInterval: 30000,
		enabled: !!userId,
	});

	const post = useMutation({
		mutationFn: () => createShout(userId, content),
		onMutate: async () => {
			await qc.cancelQueries({ queryKey: ["shouts"] });
			const prev = qc.getQueryData<ShoutItem[]>(["shouts"]);
			if (prev && user) {
				qc.setQueryData(
					["shouts"],
					[
						{
							id: `temp-${Date.now()}`,
							user_id: userId,
							content: content.trim(),
							media_url: null,
							likes_count: 0,
							created_at: new Date().toISOString(),
							author: {
								id: userId,
								display_name:
									user.user_metadata?.name ??
									user.email?.split("@")[0] ??
									"You",
								avatar_url: null,
								city: null,
								area: null,
								hide_online: false,
								last_active_at: new Date().toISOString(),
								verified: false,
							},
							has_liked: false,
						},
						...prev,
					],
				);
			}
			setContent("");
			return { prev };
		},
		onError: (_e, _v, ctx) => {
			if (ctx?.prev) qc.setQueryData(["shouts"], ctx.prev);
			pushToast("Could not post -- try again", "error");
		},
		onSuccess: (result) => {
			if (result.ok) pushToast("Shout posted");
			else pushToast(result.message, "error");
			qc.invalidateQueries({ queryKey: ["shouts"] });
		},
	});

	const like = useMutation({
		mutationFn: (shoutId: string) => toggleShoutLike(userId, shoutId),
		onMutate: async (shoutId) => {
			await qc.cancelQueries({ queryKey: ["shouts"] });
			const prev = qc.getQueryData<ShoutItem[]>(["shouts"]);
			if (prev) {
				qc.setQueryData(
					["shouts"],
					prev.map((s) =>
						s.id === shoutId
							? {
									...s,
									has_liked: !s.has_liked,
									likes_count: s.likes_count + (s.has_liked ? -1 : 1),
								}
							: s,
					),
				);
			}
			return { prev };
		},
		onError: (_e, _v, ctx) => {
			if (ctx?.prev) qc.setQueryData(["shouts"], ctx.prev);
		},
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
				The community feed. Wins, questions, chaos -- all welcome.
			</p>

			{/* composer */}
			<div className="mb-5 rounded-2xl border border-line bg-surface p-3">
				<div className="flex gap-3">
					<Avatar
						name={
							user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "You"
						}
						photoUrl={user?.user_metadata?.avatar_url}
						size={40}
					/>
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
					<span
						className={cn(
							"text-[11px]",
							content.length > 240 ? "text-rose-400" : "text-muted",
						)}
					>
						{content.length}/280
					</span>
					<button
						onClick={() => post.mutate()}
						disabled={!content.trim() || post.isPending}
						className="flex h-9 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
					>
						{post.isPending ? (
							<Spinner className="border-ink/40 border-t-ink" />
						) : (
							<Send className="h-4 w-4" />
						)}
						Shout
					</button>
				</div>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-28 rounded-2xl" />
					))}
				</div>
			) : shouts.length === 0 ? (
				<EmptyState
					icon="..."
					title="No shouts yet"
					description="Be the first to break the silence."
				/>
			) : (
				<div className="space-y-3">
					{shouts.map((s) => {
						const author = authorDisplay(s.author);
						if (!author) return null;
						return (
							<div
								key={s.id}
								className="rounded-2xl border border-line bg-surface p-4"
							>
								<div className="flex items-center gap-3">
									<Avatar
										name={author.pseudo}
										photoUrl={author.photos[0]}
										size={40}
										online={author.online}
									/>
									<div className="flex-1">
										<div className="flex items-center gap-1.5">
											<p className="text-sm font-semibold text-white">
												{author.pseudo}
											</p>
											{author.verified && (
												<Sparkles className="h-3 w-3 text-gold" />
											)}
										</div>
										<p className="text-[11px] text-muted">
											{timeAgo(s.created_at)} · {author.geo?.city || ""}
										</p>
									</div>
								</div>
								<p className="mt-3 text-sm leading-relaxed text-white/90">
									{s.content}
								</p>
								<button
									onClick={() => like.mutate(s.id)}
									className={cn(
										"mt-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
										s.has_liked
											? "bg-rose-500/15 text-rose-400"
											: "text-muted hover:bg-white/5 hover:text-rose-400",
									)}
								>
									<Heart
										className={cn("h-4 w-4", s.has_liked && "fill-rose-400")}
									/>
									{s.likes_count}
								</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
