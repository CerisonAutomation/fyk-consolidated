import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
	Zap,
	MapPin,
	Camera,
	Plus,
	Clock,
	MessageCircle,
	Coffee,
	Dumbbell,
	PartyPopper,
	Car,
	UtensilsCrossed,
	Gamepad2,
	X,
} from "lucide-react";
import { getPreferencesSnapshot } from "#/domains/settings/preferences";

export const Route = createFileRoute("/right-now/")({
	component: RightNowPage,
});

const STATUS_OPTIONS = [
	{ label: "Looking to chat", icon: MessageCircle, color: "#3b82f6" },
	{ label: "Down to hang", icon: Coffee, color: "#22c55e" },
	{ label: "At the gym", icon: Dumbbell, color: "#f59e0b" },
	{ label: "At a party", icon: PartyPopper, color: "#ec4899" },
	{ label: "On my way", icon: Car, color: "#8b5cf6" },
	{ label: "Grabbing food", icon: UtensilsCrossed, color: "#f97316" },
	{ label: "Gaming", icon: Gamepad2, color: "#06b6d4" },
	{ label: "Free tonight", icon: Zap, color: "#EAAB08" },
];

interface ActiveStatus {
	type: string;
	message: string;
	startedAt: number;
}

function RightNowPage() {
	const [activeStatus, setActiveStatus] = useState<ActiveStatus | null>(null);
	const [customMessage, setCustomMessage] = useState("");
	const [showComposer, setShowComposer] = useState(false);
	const [shareLocation, setShareLocation] = useState(
		getPreferencesSnapshot().autoUpdateLocation,
	);

	const handlePostStatus = useCallback(
		async (label: string) => {
			setActiveStatus({
				type: label,
				message: customMessage || label,
				startedAt: Date.now(),
			});
			setShowComposer(false);
			setCustomMessage("");
		},
		[customMessage],
	);

	const handleClearStatus = useCallback(() => {
		setActiveStatus(null);
	}, []);

	const formatElapsed = (startedAt: number) => {
		const mins = Math.floor((Date.now() - startedAt) / 60000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		return `${hours}h ${mins % 60}m ago`;
	};

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					{/* Header */}
					<div className="mb-6 flex items-center justify-between">
						<div>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								Right Now
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								Share what you're up to
							</p>
						</div>
						<button
							type="button"
							onClick={() => setShowComposer(!showComposer)}
							className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all"
							style={{
								background: showComposer
									? "rgba(234,179,8,0.15)"
									: "rgba(255,255,255,0.05)",
								color: showComposer ? "#EAAB08" : "rgba(255,255,255,0.5)",
								border: `1px solid ${showComposer ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.08)"}`,
							}}
						>
							{showComposer ? (
								<X className="h-4 w-4" />
							) : (
								<Plus className="h-4 w-4" />
							)}
							{showComposer ? "Cancel" : "Post"}
						</button>
					</div>

					{/* Active Status Banner */}
					{activeStatus && (
						<div
							className="mb-6 overflow-hidden rounded-2xl"
							style={{
								background: "linear-gradient(135deg, rgba(234,179,8,0.12), rgba(234,179,8,0.04))",
								border: "1px solid rgba(234,179,8,0.2)",
							}}
						>
							<div className="flex items-center gap-3 p-4">
								<div
									className="flex h-12 w-12 items-center justify-center rounded-xl"
									style={{
										background: "linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.05))",
									}}
								>
									<Zap className="h-6 w-6 text-amber-400" />
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium text-amber-400">
										Your Status
									</p>
									<p className="text-xs text-white/60">{activeStatus.message}</p>
									<p className="mt-0.5 text-[10px] text-white/30">
										<Clock className="mr-1 inline h-3 w-3" />
										{formatElapsed(activeStatus.startedAt)}
									</p>
								</div>
								<button
									type="button"
									onClick={handleClearStatus}
									className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
								>
									Clear
								</button>
							</div>
						</div>
					)}

					{/* Composer */}
					{showComposer && (
						<div
							className="mb-6 overflow-hidden rounded-2xl"
							style={{
								background: "rgba(255,255,255,0.03)",
								border: "1px solid rgba(255,255,255,0.06)",
								animation: "slide-up 0.2s ease-out",
							}}
						>
							<div className="p-4">
								<textarea
									value={customMessage}
									onChange={(e) => setCustomMessage(e.target.value)}
									placeholder="What are you up to?"
									rows={3}
									maxLength={140}
									className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
									style={{ border: "1px solid rgba(255,255,255,0.08)" }}
									autoFocus
								/>
								<div className="mt-2 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<button
											type="button"
											className="flex items-center gap-1.5 text-xs text-white/30 transition hover:text-white/50"
										>
											<Camera className="h-4 w-4" />
											Photo
										</button>
										<button
											type="button"
											onClick={() => setShareLocation(!shareLocation)}
											className={`flex items-center gap-1.5 text-xs transition ${
												shareLocation ? "text-amber-400" : "text-white/30 hover:text-white/50"
											}`}
										>
											<MapPin className="h-4 w-4" />
											Location
										</button>
									</div>
									<span className="text-[10px] text-white/20">
										{customMessage.length}/140
									</span>
								</div>
							</div>

							{/* Quick statuses */}
							<div className="border-t border-white/[0.04] p-4">
								<p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
									Quick Status
								</p>
								<div className="grid grid-cols-2 gap-2">
									{STATUS_OPTIONS.map((opt) => {
										const Icon = opt.icon;
										return (
											<button
												key={opt.label}
												type="button"
												onClick={() => handlePostStatus(opt.label)}
												className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/70 transition hover:bg-white/5"
												style={{ border: "1px solid rgba(255,255,255,0.05)" }}
											>
												<Icon className="h-4 w-4 shrink-0" style={{ color: opt.color }} />
												<span className="truncate text-xs">{opt.label}</span>
											</button>
										);
									})}
								</div>
							</div>
						</div>
					)}

					{/* Nearby statuses (demo) */}
					{!showComposer && (
						<div className="space-y-3">
							<p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
								NEARBY
							</p>

							{[
								{
									name: "Alex",
									status: "Looking to chat",
									time: "12m ago",
									distance: "0.3 km",
									avatar: "A",
								},
								{
									name: "Marcus",
									status: "At the gym",
									time: "28m ago",
									distance: "1.2 km",
									avatar: "M",
								},
								{
									name: "Jordan",
									status: "Free tonight",
									time: "1h ago",
									distance: "0.8 km",
									avatar: "J",
								},
							].map((item, idx) => (
								<div
									key={idx}
									className="glass-card flex items-center gap-3 px-4 py-3"
								>
									<div
										className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold"
										style={{
											background: `linear-gradient(135deg, ${STATUS_OPTIONS[idx % STATUS_OPTIONS.length]?.color}22, ${STATUS_OPTIONS[idx % STATUS_OPTIONS.length]?.color}08)`,
											color: STATUS_OPTIONS[idx % STATUS_OPTIONS.length]?.color,
										}}
									>
										{item.avatar}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="text-sm font-medium text-white/90">{item.name}</p>
											<span className="relative flex h-2 w-2">
												<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
												<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
											</span>
										</div>
										<p className="text-xs text-white/50">{item.status}</p>
									</div>
									<div className="text-right">
										<p className="text-[10px] text-white/30">{item.distance}</p>
										<p className="text-[10px] text-white/20">{item.time}</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<style>{`
				@keyframes slide-up {
					from { opacity: 0; transform: translateY(10px); }
					to { opacity: 1; transform: translateY(0); }
				}
			`}</style>
		</main>
	);
}
