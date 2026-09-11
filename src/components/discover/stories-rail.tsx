"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import {
	createStory,
	loadStoryRings,
	type StoryItem,
	type StoryRing,
	viewStory,
} from "#/integrations/supabase/stories";
import { useAppStore } from "#/lib/store";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const BG: Record<string, string> = {
	gold: "linear-gradient(135deg,#D4AF37,#8a6a1a)",
	violet: "linear-gradient(135deg,#8B5CF6,#4c1d95)",
	sunset: "linear-gradient(135deg,#f97316,#be185d)",
	ocean: "linear-gradient(135deg,#0ea5e9,#1e3a8a)",
	forest: "linear-gradient(135deg,#10b981,#065f46)",
	rose: "linear-gradient(135deg,#f43f5e,#881337)",
};

const PRESETS = [
	{
		url: "https://images.unsplash.com/photo-1495954484750-af469f2f9be5?w=800&q=80",
		label: "Coffee",
		bg: "sunset",
	},
	{
		url: "https://images.unsplash.com/photo-1517824806704-9040b037703b?w=800&q=80",
		label: "Night out",
		bg: "violet",
	},
	{
		url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
		label: "Work",
		bg: "ocean",
	},
];

// ─── Component ───────────────────────────────────────────────────────────────

export function StoriesRail() {
	const qc = useQueryClient();
	const { user: authUser } = useSupabaseSession();
	const me = useAppStore((s) => s.user);
	const [viewing, setViewing] = useState<{
		ring: StoryRing | "mine";
		items: StoryItem[];
		authorName?: string;
		authorAvatar?: string;
	} | null>(null);
	const [idx, setIdx] = useState(0);
	const [composing, setComposing] = useState(false);

	// ── Load story rings from Supabase ────────────────────────────────────
	const { data, isLoading } = useQuery({
		queryKey: ["stories"],
		queryFn: async () => {
			if (!authUser)
				return { mine: [] as StoryItem[], rings: [] as StoryRing[] };
			const result = await loadStoryRings(authUser.id);
			if (!result.ok)
				return { mine: [] as StoryItem[], rings: [] as StoryRing[] };
			return result.data;
		},
		enabled: !!authUser,
	});

	// ── Mark story as viewed ──────────────────────────────────────────────
	const markViewed = useMutation({
		mutationFn: async (storyId: string) => {
			if (!authUser) return;
			await viewStory(storyId, authUser.id);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["stories"] });
		},
	});

	// ── Create story ──────────────────────────────────────────────────────
	const create = useMutation({
		mutationFn: async (input: {
			media_url: string;
			caption?: string;
			background?: string;
		}) => {
			if (!authUser) throw new Error("Not signed in");
			const result = await createStory(
				authUser.id,
				input.media_url,
				input.caption,
				input.background,
			);
			if (!result.ok) throw new Error(result.message);
		},
		onSuccess: () => {
			setComposing(false);
			qc.invalidateQueries({ queryKey: ["stories"] });
		},
	});

	// ── Auto-advance while viewing ────────────────────────────────────────
	useEffect(() => {
		if (!viewing) return;
		const item = viewing.items[idx];
		if (item && !item.viewed) markViewed.mutate(item.id);
		const t = setTimeout(() => {
			if (idx + 1 < viewing.items.length) {
				setIdx(idx + 1);
			} else {
				setViewing(null);
			}
		}, 4000);
		return () => clearTimeout(t);
	}, [viewing, idx, markViewed]);

	// ── Loading state ─────────────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="mb-5 flex gap-3 overflow-x-auto pb-1">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="flex flex-col items-center gap-1.5">
						<Skeleton className="h-16 w-16 rounded-full" />
						<Skeleton className="h-2 w-10" />
					</div>
				))}
			</div>
		);
	}

	const rings = data?.rings ?? [];
	const mine = data?.mine ?? [];

	// ── Render ────────────────────────────────────────────────────────────
	return (
		<>
			<div className="mb-5 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{/* Create button */}
				<button
					onClick={() => setComposing(true)}
					className="flex shrink-0 flex-col items-center gap-1.5"
				>
					<div className="relative">
						<div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-white/5 text-white/40">
							<Plus className="h-6 w-6" />
						</div>
						<span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-gold text-ink">
							<Plus className="h-3 w-3" strokeWidth={3} />
						</span>
					</div>
					<span className="text-[10px] text-muted">
						{mine.length > 0 ? "Yours" : "Add"}
					</span>
				</button>

				{/* My story ring */}
				{mine.length > 0 && (
					<button
						onClick={() =>
							setViewing({
								ring: "mine",
								items: mine,
								authorName: me?.pseudo ?? "You",
								authorAvatar: me?.photos?.[0],
							})
						}
						className="flex shrink-0 flex-col items-center gap-1.5"
					>
						<div className="rounded-full bg-gradient-to-tr from-gold to-gold-soft p-[2px]">
							<div className="rounded-full border-2 border-ink">
								<div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/60">
									{me?.pseudo?.charAt(0)?.toUpperCase() ?? "Y"}
								</div>
							</div>
						</div>
						<span className="text-[10px] text-gold-soft">You</span>
					</button>
				)}

				{/* Other rings */}
				{rings.map((r) => {
					const hasNew = r.items.some((i) => !i.viewed);
					return (
						<button
							key={r.userId}
							onClick={() => {
								setViewing({
									ring: r,
									items: r.items,
									authorName: r.userName,
									authorAvatar: r.userAvatar,
								});
								setIdx(0);
							}}
							className="flex shrink-0 flex-col items-center gap-1.5"
						>
							<div
								className={cn(
									"rounded-full p-[2px]",
									hasNew
										? "bg-gradient-to-tr from-gold via-gold-soft to-gold"
										: "bg-line",
								)}
							>
								<div className="rounded-full border-2 border-ink">
									{r.userAvatar ? (
										<img
											src={r.userAvatar}
											alt={r.userName}
											className="h-[60px] w-[60px] rounded-full object-cover"
										/>
									) : (
										<div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/60">
											{r.userName.charAt(0).toUpperCase()}
										</div>
									)}
								</div>
							</div>
							<span
								className={cn(
									"max-w-16 truncate text-[10px]",
									hasNew ? "text-white" : "text-muted",
								)}
							>
								{r.userName}
							</span>
						</button>
					);
				})}
			</div>

			{/* Story Viewer */}
			{viewing && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/95 p-4">
					<button
						onClick={() => setViewing(null)}
						className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
					>
						<X className="h-5 w-5" />
					</button>

					{/* Progress bars */}
					<div className="absolute inset-x-4 top-4 z-10 flex gap-1">
						{viewing.items.map((_, i) => (
							<div
								key={i}
								className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20"
							>
								<div
									className={cn(
										"h-full bg-white transition-all duration-300",
										i < idx && "w-full",
										i === idx && "w-1/2",
									)}
								/>
							</div>
						))}
					</div>

					<div className="relative h-full max-h-[85vh] w-full max-w-sm overflow-hidden rounded-3xl">
						{/* Story image */}
						<img
							src={viewing.items[idx]?.media_url}
							alt=""
							width={384}
							height={683}
							decoding="async"
							className="h-full w-full object-cover"
						/>
						<div
							className="absolute inset-0 opacity-30"
							style={{
								background: BG[viewing.items[idx]?.background ?? "gold"],
							}}
						/>

						{/* Author info */}
						<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-5">
							<div className="flex items-center gap-2.5">
								{viewing.authorAvatar ? (
									<img
										src={viewing.authorAvatar}
										alt=""
										width={34}
										height={34}
										loading="lazy"
										decoding="async"
										className="h-[34px] w-[34px] rounded-full object-cover"
									/>
								) : (
									<div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/60">
										{viewing.authorName?.charAt(0)?.toUpperCase() ?? "?"}
									</div>
								)}
								<div>
									<p className="text-sm font-semibold text-white">
										{viewing.authorName ?? "Unknown"}
									</p>
									<p className="text-[11px] text-white/60">
										{viewing.items[idx]?.created_at
											? new Date(
													viewing.items[idx].created_at,
												).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})
											: ""}
									</p>
								</div>
							</div>
							{viewing.items[idx]?.caption && (
								<p className="mt-3 text-base leading-snug text-white">
									{viewing.items[idx].caption}
								</p>
							)}
						</div>

						{/* Tap zones for navigation */}
						<button
							className="absolute inset-y-0 left-0 w-1/3"
							onClick={() => setIdx(Math.max(0, idx - 1))}
						/>
						<button
							className="absolute inset-y-0 right-0 w-1/3"
							onClick={() =>
								idx + 1 < viewing.items.length
									? setIdx(idx + 1)
									: setViewing(null)
							}
						/>
					</div>
				</div>
			)}

			{/* Story Composer */}
			{composing && (
				<div
					className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 p-4"
					onClick={() => setComposing(false)}
				>
					<div
						className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="mb-3 text-sm font-semibold text-white">
							Post a story
						</h3>
						<p className="mb-3 text-xs text-muted">
							Stories last 24 hours. Paste an image URL or pick a preset.
						</p>
						<StoryComposer
							onSubmit={(v) => create.mutate(v)}
							busy={create.isPending}
						/>
					</div>
				</div>
			)}
		</>
	);
}

// ─── Story Composer ──────────────────────────────────────────────────────────

function StoryComposer({
	onSubmit,
	busy,
}: {
	onSubmit: (v: {
		media_url: string;
		caption?: string;
		background?: string;
	}) => void;
	busy: boolean;
}) {
	const [url, setUrl] = useState("");
	const [caption, setCaption] = useState("");
	const [bg, setBg] = useState("gold");

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-3 gap-2">
				{PRESETS.map((p) => (
					<button
						key={p.label}
						onClick={() => {
							setUrl(p.url);
							setBg(p.bg);
						}}
						className={cn(
							"overflow-hidden rounded-xl border transition-colors",
							url === p.url ? "border-gold" : "border-line",
						)}
					>
						<img
							src={p.url}
							alt={p.label}
							width={200}
							height={64}
							loading="lazy"
							decoding="async"
							className="h-16 w-full object-cover"
						/>
						<span className="block py-1 text-[10px] text-muted">{p.label}</span>
					</button>
				))}
			</div>
			<input
				value={url}
				onChange={(e) => setUrl(e.target.value)}
				placeholder="...or paste an image URL"
				className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
			/>
			<input
				value={caption}
				onChange={(e) => setCaption(e.target.value)}
				placeholder="Add a caption"
				className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
			/>
			<div className="flex flex-wrap gap-1.5">
				{Object.keys(BG).map((k) => (
					<button
						key={k}
						onClick={() => setBg(k)}
						className={cn(
							"h-7 w-7 rounded-full border-2",
							bg === k ? "border-white" : "border-transparent",
						)}
						style={{ background: BG[k] }}
					/>
				))}
			</div>
			<button
				onClick={() => onSubmit({ media_url: url, caption, background: bg })}
				disabled={!url.trim() || busy}
				className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
			>
				{busy ? "Posting..." : "Post story"}
			</button>
		</div>
	);
}
