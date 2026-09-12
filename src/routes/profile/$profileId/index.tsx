import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	Ban,
	Heart,
	Loader2,
	MapPin,
	MessageCircle,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { ReportDialog } from "#/components/ReportDialog";
import { Avatar } from "#/components/ui/Avatar";
import { MediaImage } from "#/components/ui/MediaImage";
import { describeFailure, StateBlock } from "#/components/ui/StateBlock";
import type { ProfileView, TapResult } from "#/lib/api-types";
import { api } from "#/lib/client";
import { useToasts } from "#/lib/toast";
import { timeAgo } from "#/lib/utils";

export const Route = createFileRoute("/profile/$profileId/")({
	component: ProfilePage,
	head: () => ({
		meta: [{ title: "Profile — FYK" }, { name: "robots", content: "noindex" }],
	}),
});

const PRESENCE_LABEL = {
	online: "Online now",
	active: "Recently active",
	offline: "Offline",
} as const;

function ProfilePage() {
	const { profileId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const push = useToasts((state) => state.push);
	const [reportOpen, setReportOpen] = useState(false);
	const [photoIndex, setPhotoIndex] = useState(0);

	const { data, isPending, error } = useQuery({
		queryKey: ["profile", profileId],
		queryFn: () => api.get<ProfileView>(`profile/${profileId}`),
	});

	const tap = useMutation({
		mutationFn: (action: "tap" | "favorite" | "unfavorite" | "pass") =>
			api.post<TapResult>("taps", { targetId: profileId, action }),
		onSuccess: (result, action) => {
			void queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
			void queryClient.invalidateQueries({ queryKey: ["discover"] });
			void queryClient.invalidateQueries({ queryKey: ["conversations"] });
			if (result.matched && action === "tap") {
				if (result.conversationId)
					void navigate({
						to: "/chat/$conversationId",
						params: { conversationId: result.conversationId },
					});
				else void navigate({ to: "/chat" });
				return;
			}
			push(
				action === "tap"
					? "Tap sent. They will see it in their likes."
					: action === "favorite"
						? "Saved to your favorites."
						: action === "unfavorite"
							? "Removed from favorites."
							: "Passed.",
				"success",
			);
		},
		onError: (err) =>
			push(err instanceof Error ? err.message : "That did not save.", "error"),
	});

	const block = useMutation({
		mutationFn: () =>
			api.post<{ blocked: boolean }>("blocks", { targetId: profileId }),
		onSuccess: () => {
			push("Blocked. They can no longer see you or message you.", "success");
			void queryClient.invalidateQueries({ queryKey: ["blocks"] });
			void queryClient.invalidateQueries({ queryKey: ["discover"] });
		},
		onError: (err) =>
			push(err instanceof Error ? err.message : "That did not work.", "error"),
	});

	const failure = error ? describeFailure(error) : null;
	const profile = data?.profile;
	const relationship = data?.relationship;
	const photo = profile?.photos[photoIndex];

	if (isPending) return <StateBlock kind="loading" title="Loading profile" />;
	if (failure || !profile) {
		return (
			<StateBlock
				kind="error"
				title="This profile is not visible"
				description={
					failure?.message ??
					"It may have been removed, suspended, or its privacy settings hide it from you."
				}
				action={
					<button
						type="button"
						onClick={() => void navigate({ to: "/grid" })}
						className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black"
					>
						Back to Nearby
					</button>
				}
			/>
		);
	}

	return (
		<div className="mx-auto max-w-2xl pb-28">
			<div className="overflow-hidden rounded-3xl border border-line bg-surface">
				<div className="relative">
					{photo ? (
						<MediaImage
							key={photo.url}
							src={photo.url}
							alt={`${profile.displayName}'s photo ${photoIndex + 1}`}
							ratio="4 / 5"
							priority
							className="w-full"
							label="This photo could not be loaded"
						/>
					) : (
						<div className="grid aspect-[4/5] w-full place-items-center bg-[radial-gradient(ellipse_at_top,var(--color-gold-ghost),transparent)]">
							<Avatar
								name={profile.displayName}
								photoUrl={profile.avatarUrl}
								size={96}
							/>
						</div>
					)}
					{profile.photos.length > 1 && (
						<div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 p-3">
							{profile.photos.map((entry, index) => (
								<button
									key={entry.url}
									type="button"
									aria-label={`Photo ${index + 1}`}
									aria-current={index === photoIndex}
									onClick={() => setPhotoIndex(index)}
									className={`h-1.5 rounded-full transition-all ${index === photoIndex ? "w-6 bg-gold" : "w-1.5 bg-white/45"}`}
								/>
							))}
						</div>
					)}
					{profile.photos.length > 1 && (
						<div className="absolute inset-x-0 top-0 flex justify-between p-3">
							<button
								type="button"
								onClick={() =>
									setPhotoIndex(
										(index) =>
											(index - 1 + profile.photos.length) %
											profile.photos.length,
									)
								}
								className="press grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white"
								aria-label="Previous photo"
							>
								‹
							</button>
							<button
								type="button"
								onClick={() =>
									setPhotoIndex((index) => (index + 1) % profile.photos.length)
								}
								className="press grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white"
								aria-label="Next photo"
							>
								›
							</button>
						</div>
					)}
				</div>

				<div className="p-5">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em]">
								{profile.displayName}
								{profile.age ? (
									<span className="font-normal text-muted">
										, {profile.age}
									</span>
								) : null}
							</h1>
							<p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
								{profile.handle ? (
									<span className="font-mono text-[12.5px]">
										@{profile.handle}
									</span>
								) : null}
								<span
									className={
										profile.presence === "online" ? "text-emerald-400" : ""
									}
								>
									{PRESENCE_LABEL[profile.presence]}
									{profile.presence === "offline"
										? ` · ${timeAgo(profile.lastActiveAt)}`
										: ""}
								</span>
							</p>
						</div>
						<span className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2">
							<MapPin className="h-3.5 w-3.5 text-gold" />
							{profile.distanceLabel ?? profile.city ?? "Location hidden"}
						</span>
					</div>

					{profile.headline && (
						<p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
							{profile.headline}
						</p>
					)}

					<div className="mt-4 flex flex-wrap gap-1.5">
						{profile.pronouns && <Tag>{profile.pronouns}</Tag>}
						{profile.bodyType && <Tag>{profile.bodyType}</Tag>}
						{profile.positionRole && <Tag>{profile.positionRole}</Tag>}
						{profile.heightCm && <Tag>{profile.heightCm} cm</Tag>}
						{profile.lookingFor.map((entry) => (
							<Tag key={entry} tone="live">
								{entry}
							</Tag>
						))}
						{profile.exposureLevel !== "clean" && (
							<Tag tone="violet">{profile.exposureLevel}</Tag>
						)}
					</div>

					{profile.bio && (
						<p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-2">
							{profile.bio}
						</p>
					)}

					{profile.sharedInterests.length > 0 && (
						<div className="mt-5 rounded-2xl border border-line bg-surface-2 p-3.5">
							<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
								Shared interests
							</p>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{profile.sharedInterests.map((entry) => (
									<span
										key={entry}
										className="rounded-full bg-gold/10 px-2 py-0.5 text-[12px] text-gold"
									>
										{entry}
									</span>
								))}
							</div>
							<p className="mt-2 text-[11.5px] leading-relaxed text-faint">
								FYK matches on shared tags only. There is no compatibility score
								and no ranking model, so nobody can explain why you saw someone
								— which is the honest version.
							</p>
						</div>
					)}

					{profile.isSuspended && (
						<p
							role="alert"
							className="mt-4 flex items-start gap-2 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] text-live"
						>
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> This account
							is suspended. Its profile stays here for context but it cannot
							interact.
						</p>
					)}
				</div>
			</div>

			{relationship?.blocked ? (
				<p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-[13.5px] text-muted">
					You have a block in place with this member, so tapping and messaging
					are unavailable. Manage blocks in Safety.
				</p>
			) : (
				<div className="fixed inset-x-0 bottom-[68px] z-20 mx-auto flex max-w-2xl gap-2 px-4 md:static md:mt-4 md:max-w-2xl md:px-0">
					<button
						type="button"
						onClick={() =>
							relationship?.iTapped
								? push("You already tapped them. Nothing to repeat.", "info")
								: tap.mutate("tap")
						}
						className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black"
					>
						{tap.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Sparkles className="h-4 w-4" />
						)}
						{relationship?.iTapped ? "Tapped" : "Tap"}
					</button>
					<button
						type="button"
						onClick={() =>
							tap.mutate(relationship?.iFavorited ? "unfavorite" : "favorite")
						}
						aria-pressed={Boolean(relationship?.iFavorited)}
						className="press grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-live"
						aria-label={
							relationship?.iFavorited
								? "Remove from favorites"
								: "Save to favorites"
						}
					>
						<Heart
							className={
								relationship?.iFavorited ? "h-5 w-5 fill-current" : "h-5 w-5"
							}
						/>
					</button>
					{relationship?.isMatch ? (
						<button
							type="button"
							onClick={() => void navigate({ to: "/chat" })}
							className="press flex h-12 items-center gap-2 rounded-full border border-gold/50 bg-gold-ghost px-4 text-[14px] font-bold text-gold"
						>
							<MessageCircle className="h-4 w-4" /> Chat
						</button>
					) : null}
					<button
						type="button"
						onClick={() => setReportOpen(true)}
						className="press grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-muted hover:text-live"
						aria-label="Report this member"
					>
						<ShieldAlert className="h-5 w-5" />
					</button>
					<button
						type="button"
						onClick={() => block.mutate()}
						className="press grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-muted hover:text-live"
						aria-label="Block this member"
					>
						<Ban className="h-5 w-5" />
					</button>
				</div>
			)}

			{reportOpen && (
				<ReportDialog
					targetType="profile"
					targetId={profileId}
					targetLabel={profile.displayName}
					onClose={() => setReportOpen(false)}
				/>
			)}
		</div>
	);
}

function Tag({
	children,
	tone = "default",
}: {
	children: React.ReactNode;
	tone?: "default" | "live" | "violet";
}) {
	const classes =
		tone === "live"
			? "border-live/40 bg-live/10 text-live"
			: tone === "violet"
				? "border-violet/40 bg-violet/10 text-violet"
				: "border-line bg-surface-2 text-ink-2";
	return (
		<span
			className={`rounded-full border px-2.5 py-1 text-[12px] font-medium ${classes}`}
		>
			{children}
		</span>
	);
}
