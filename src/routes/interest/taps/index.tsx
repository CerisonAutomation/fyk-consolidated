import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useTapsStore } from "#/domains/interest/store";
import {
	Heart,
	Sparkles,
	MoreVertical,
} from "lucide-react";

export const Route = createFileRoute("/interest/taps/")({
	component: TapsPage,
});

function TapsPage() {
	const { taps, loading, error, hasUnseen, hasMore, loadMore, markViewed } =
		useTapsStore();
	const [activeTab, setActiveTab] = useState<"all" | "mutual">("all");

	const filteredTaps = activeTab === "mutual" ? taps.filter((t) => t.isMutual) : taps;

	const handleMarkAllSeen = useCallback(() => {
		markViewed();
	}, [markViewed]);

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					{/* Header */}
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								Taps
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								{taps.length === 0 ? "No taps yet" : `${taps.length} total`}
							</p>
						</div>
						{hasUnseen && (
							<button
								type="button"
								onClick={handleMarkAllSeen}
								className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20"
							>
								Mark all seen
							</button>
						)}
					</div>

					{/* Tabs */}
					<div className="mb-4 flex gap-1 rounded-xl bg-white/[0.03] p-1">
						{[
							{ key: "all" as const, label: "All Taps", count: taps.length },
							{
								key: "mutual" as const,
								label: "Mutual",
								count: taps.filter((t) => t.isMutual).length,
							},
						].map((tab) => (
							<button
								key={tab.key}
								type="button"
								onClick={() => setActiveTab(tab.key)}
								className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all"
								style={{
									background:
										activeTab === tab.key
											? "rgba(234,179,8,0.12)"
											: "transparent",
									color:
										activeTab === tab.key
											? "#EAAB08"
											: "rgba(255,255,255,0.4)",
								}}
							>
								{tab.label}
								{tab.count > 0 && (
									<span
										className="rounded-full px-1.5 py-0.5 text-[10px]"
										style={{
											background:
												activeTab === tab.key
													? "rgba(234,179,8,0.2)"
													: "rgba(255,255,255,0.05)",
										}}
									>
										{tab.count}
									</span>
								)}
							</button>
						))}
					</div>

					{/* Content */}
					{loading ? (
						<div className="flex flex-col gap-2">
							{Array.from({ length: 6 }).map((_, i) => (
								<div
									key={i}
									className="flex items-center gap-3 animate-pulse"
									style={{ animationDelay: `${i * 60}ms` }}
								>
									<div className="h-14 w-14 rounded-full bg-white/5" />
									<div className="flex-1 space-y-2">
										<div className="h-4 w-32 rounded bg-white/5" />
										<div className="h-3 w-24 rounded bg-white/5" />
									</div>
								</div>
							))}
						</div>
					) : error ? (
						<div className="flex flex-col items-center gap-4 py-12">
							<p className="text-sm text-red-400">{error.message}</p>
						</div>
					) : filteredTaps.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20">
							<div
								className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
								style={{
									background:
										"color-mix(in srgb, var(--accent-primary) 8%, transparent)",
								}}
							>
								<Heart className="h-10 w-10 text-amber-400/30" />
							</div>
							<h3 className="font-display text-lg text-white/60">
								{activeTab === "mutual" ? "No mutual taps" : "No taps yet"}
							</h3>
							<p className="mt-1 max-w-xs text-center text-sm text-white/30">
								{activeTab === "mutual"
									? "When someone you tapped taps you back, they'll show up here."
									: "When someone taps your profile, they'll appear here."}
							</p>
						</div>
					) : (
						<div className="space-y-1">
							{filteredTaps.map((tap) => (
								<Link
									key={tap.profileId}
									to="/profile/$profileId"
									params={{ profileId: String(tap.profileId) }}
									className="glass-card flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.06]"
								>
									<div className="relative h-14 w-14 shrink-0">
										<div
											className="flex h-full w-full items-center justify-center rounded-full text-lg font-bold"
											style={{
												background: tap.isMutual
													? "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))"
													: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))",
												color: tap.isMutual ? "#22c55e" : "#EAAB08",
											}}
										>
											{tap.displayName?.charAt(0) ?? "?"}
										</div>
										{tap.isMutual && (
											<div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[8px] text-white">
												💚
											</div>
										)}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="truncate text-sm font-medium text-white/90">
												{tap.displayName ?? "Anonymous"}
											</p>
											{tap.isFavorite && (
												<span className="text-xs text-amber-400">★</span>
											)}
											{tap.isBoosting && (
												<Sparkles className="h-3 w-3 text-purple-400" />
											)}
										</div>
										<p className="text-xs text-white/40">
											Tapped {formatTimeAgo(tap.timestamp)}
											{tap.distance !== null && ` · ${formatDistance(tap.distance)}`}
										</p>
									</div>
									<div className="flex items-center gap-2">
										{tap.isMutual && (
											<span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
												Mutual
											</span>
										)}
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
											}}
											className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/5"
										>
											<MoreVertical className="h-4 w-4" />
										</button>
									</div>
								</Link>
							))}

							{hasMore && (
								<button
									type="button"
									onClick={loadMore}
									className="w-full py-4 text-center text-sm text-amber-400/70 transition hover:text-amber-400"
								>
									Load more
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</main>
	);
}

function formatTimeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function formatDistance(metres: number): string {
	if (metres < 1000) return `${Math.round(metres)}m`;
	return `${(metres / 1000).toFixed(1)}km`;
}
