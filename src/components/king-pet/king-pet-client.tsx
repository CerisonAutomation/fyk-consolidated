"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Armchair,
	Backpack,
	Check,
	Clock,
	Crown,
	Flame,
	PartyPopper,
	PawPrint,
	Play,
	Shirt,
	Sparkles,
	UtensilsCrossed,
	X,
} from "lucide-react";
import { useState } from "react";
import {
	Badge,
	Button,
	EmptyState,
	Skeleton,
} from "@/components/ui/primitives";
import {
	loadPetData,
	performPetAction,
	type PetAction,
} from "@/core/api/pet";
import { useSupabaseSession } from "@/integrations/supabase/session-provider";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// `elder` is a real stage in `king_pet_stage_check` and the server's curve can
// reach it at level 16, so it needs a face: `STAGE_EMOJI[stage]` used to render
// `undefined` (an empty pet in a gradient circle) for anything past `adult`.
const STAGE_EMOJI: Record<string, string> = {
	baby: "🐣",
	juvenile: "🐥",
	adult: "👑",
	elder: "🦁",
};
const MOOD_EMOJI: Record<string, string> = {
	happy: "😊",
	hungry: "😋",
	sleepy: "😴",
	excited: "🤩",
	sad: "😢",
};

// `as const`, because the mutation takes a closed union now: the server refuses
// an action it does not implement, and this list is what it implements
// (`PET_ACTIONS` in `#/lib/economy` holds the XP and cooldowns shown here).
const ACTIONS = [
	{
		key: "feed",
		label: "Feed",
		icon: UtensilsCrossed,
		desc: "+20 XP · streak",
	},
	{ key: "play", label: "Play", icon: Play, desc: "+25 XP" },
	{ key: "rest", label: "Rest", icon: Armchair, desc: "+10 XP" },
	{ key: "dress", label: "Dress up", icon: Shirt, desc: "+15 XP" },
] as const;

export function KingPetClient() {
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);
	const { user } = useSupabaseSession();
	const userId = user?.id;

	const [tab, setTab] = useState<"home" | "wardrobe" | "adventures" | "log">(
		"home",
	);
	const [celebrate, setCelebrate] = useState<string | null>(null);
	const [renaming, setRenaming] = useState(false);
	const [name, setName] = useState("");

	const { data, isLoading, isError, error, refetch } = useQuery({
		queryKey: ["pet", userId],
		queryFn: async () => {
			if (!userId) throw new Error("Not authenticated");
			// The pet belongs to the session the API verified, so no id is passed:
			// `GET /api/king-pet` also collects a finished trip on the way in, which
			// is why there is no "claim" button to forget to press.
			return loadPetData();
		},
		enabled: !!userId,
	});

	const act = useMutation({
		mutationFn: async (vars: PetAction) => {
			if (!userId) throw new Error("Not authenticated");
			// `api()` throws `ApiError(status, message)`, so the reasons the server
			// gives — a cooldown, "Not enough bones", "You have not bought Cape yet" —
			// reach the toast instead of a generic "Failed".
			return performPetAction(vars);
		},
		onSuccess: (res, vars) => {
			qc.setQueryData(["pet", userId], (old: typeof data) => {
				if (!old) return old;
				return { ...old, pet: res.pet, bones: res.pet.bones };
			});
			qc.invalidateQueries({ queryKey: ["wallet", userId] });

			if (res.leveledUp) {
				setCelebrate(`🎉 ${res.pet.name} reached level ${res.pet.level}!`);
				setTimeout(() => setCelebrate(null), 2500);
			} else if (res.reward) {
				pushToast(
					`${res.reward.theme} complete! +${res.reward.amount} ${res.reward.type === "bones" ? "🦴" : "XP"}`,
				);
			} else if (res.pending) {
				// An adventure takes its `duration_minutes` and pays on return; the old
				// client module awarded the reward the instant the button was pressed,
				// which made "Night Market, 60 minutes" a click.
				const backAt = new Date(res.pending.endsAt).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				});
				pushToast(`${res.pending.emoji} ${res.pending.theme} — back at ${backAt}`);
			} else {
				const a = vars.action;
				pushToast(
					`${data?.pet.name ?? "Your pet"} ${a === "feed" ? "is fed and happy 🍖" : a === "play" ? "had a blast! 🎾" : a === "rest" ? "is resting 😴" : "is looking sharp ✨"}`,
				);
			}
		},
		onError: (e) =>
			pushToast(e instanceof Error ? e.message : "Failed", "error"),
	});

	if (isLoading || !data) {
		// Same fix as the premium screen: a failed read must not look like a
		// skeleton forever, because "the pet is not loading" and "the pet could not
		// be read" need different answers from a user.
		if (isError)
			return (
				<div className="mx-auto max-w-md">
					<EmptyState
						icon={<PawPrint className="h-6 w-6 text-gold" />}
						title="Your pet is asleep"
						description={
							error instanceof Error
								? error.message
								: "We could not reach the pet service."
						}
						action={
							<Button size="sm" onClick={() => refetch()}>
								Wake them up
							</Button>
						}
					/>
				</div>
			);
		return (
			<div className="mx-auto max-w-md">
				<Skeleton className="mb-4 h-8 w-40" />
				<Skeleton className="aspect-square rounded-3xl" />
			</div>
		);
	}

	const { pet, items, adventures, bones } = data;
	const progress = Math.min(
		100,
		Math.round((pet.experience / (pet.level * 100)) * 100),
	);
	const owned = new Set(pet.wardrobe);
	const equipped = new Set(pet.equipped);

	return (
		<div className="mx-auto max-w-md">
			<div className="mb-2 flex items-center gap-2">
				<PawPrint className="h-5 w-5 text-gold" />
				<h1 className="text-xl font-bold text-white">King Pet</h1>
				<button
					onClick={() => setRenaming(true)}
					className="ml-auto text-[11px] text-muted hover:text-gold"
				>
					Rename
				</button>
			</div>
			<p className="mb-4 text-sm text-muted">
				Your companion grows as you stay active. Keep the streak alive.
			</p>

			{celebrate && (
				<div className="mb-4 flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 p-4 animate-in">
					<PartyPopper className="h-5 w-5 text-gold" />
					<span className="text-sm font-semibold text-gold-soft">
						{celebrate}
					</span>
				</div>
			)}

			{/* pet card */}
			<div className="relative mb-4 overflow-hidden rounded-3xl border border-line bg-surface p-6 text-center">
				<div className="absolute left-4 top-4 flex flex-col gap-1.5">
					<span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-soft">
						<Crown className="h-3 w-3" /> Lv {pet.level}
					</span>
					<span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-white">
						{bones} 🦴
					</span>
					{pet.streak > 0 && (
						<span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300">
							<Flame className="h-3 w-3" /> {pet.streak}d
						</span>
					)}
				</div>
				<span className="absolute right-4 top-4 rounded-full bg-white/5 px-2.5 py-1 text-xs text-muted capitalize">
					{pet.stage}
				</span>

				<div className="relative mx-auto my-5 flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 via-purple-600/15 to-transparent">
					{equipped.has("Golden Crown") && (
						<span className="absolute -top-1 text-3xl">👑</span>
					)}
					{equipped.has("Sunglasses") && (
						<span className="absolute top-12 text-2xl">🕶️</span>
					)}
					{equipped.has("Bandana") && (
						<span className="absolute bottom-6 text-2xl">🧣</span>
					)}
					{equipped.has("Sneakers") && (
						<span className="absolute -bottom-1 text-xl">👟</span>
					)}
					{equipped.has("Cape") && (
						<span className="absolute -left-6 top-8 text-2xl">🦸</span>
					)}
					<span className="animate-float text-7xl">
						{STAGE_EMOJI[pet.stage]}
					</span>
				</div>

				<h2 className="text-2xl font-bold text-white">
					{pet.name} <span className="text-xl">{MOOD_EMOJI[pet.mood]}</span>
				</h2>
				<div className="mt-1.5 flex justify-center gap-2">
					<Badge color="gold">{pet.stage}</Badge>
					<Badge color="purple">{pet.mood}</Badge>
				</div>

				<div className="mt-5">
					<div className="mb-1 flex justify-between text-xs text-muted">
						<span>XP to level {pet.level + 1}</span>
						<span>
							{pet.experience} / {pet.level * 100}
						</span>
					</div>
					<div className="h-2.5 overflow-hidden rounded-full bg-white/10">
						<div
							className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-[width] duration-500"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			</div>

			{/* tabs */}
			<div className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
				{(["home", "wardrobe", "adventures", "log"] as const).map((t) => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={cn(
							"rounded-lg py-2 text-xs font-medium capitalize transition-colors",
							tab === t ? "bg-gold text-ink" : "text-muted hover:text-white",
						)}
					>
						{t === "log" ? "Mood" : t}
					</button>
				))}
			</div>

			{tab === "home" && (
				<>
					<div className="grid grid-cols-2 gap-2.5">
						{ACTIONS.map((a) => {
							const Icon = a.icon;
							return (
								<button
									key={a.key}
									onClick={() => act.mutate({ action: a.key })}
									disabled={act.isPending}
									className="group flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 disabled:opacity-60"
								>
									<span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold transition-colors group-hover:bg-gold group-hover:text-ink">
										<Icon className="h-5 w-5" />
									</span>
									<span className="text-sm font-medium text-white">
										{a.label}
									</span>
									<span className="text-[10px] text-muted">{a.desc}</span>
								</button>
							);
						})}
					</div>

					<div className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-surface p-4">
						<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
						<p className="text-xs leading-relaxed text-muted">
							Feed <span className="text-gold-soft">{pet.name}</span> daily to
							build your streak. Streaks earn bonus bones — and bones buy
							adventures and outfits.
						</p>
					</div>
				</>
			)}

			{tab === "wardrobe" &&
				(items.length === 0 ? (
					<EmptyState
						icon="👕"
						title="Shop is empty"
						description="Items will appear here."
					/>
				) : (
					<div className="grid grid-cols-2 gap-2.5">
						{items.map((i) => {
							const isOwned = owned.has(i.name);
							const isEquipped = equipped.has(i.name);
							const stageIdx = ["baby", "juvenile", "adult"].indexOf(pet.stage);
							const reqIdx = ["baby", "juvenile", "adult"].indexOf(
								i.stage_required,
							);
							const locked = stageIdx < reqIdx;
							return (
								<div
									key={i.id}
									className={cn(
										"rounded-2xl border p-3 text-center transition-colors",
										isEquipped
											? "border-gold/45 bg-gold/[0.08]"
											: "border-line bg-surface",
									)}
								>
									<div className="mb-1 text-3xl">{i.emoji}</div>
									<p className="truncate text-xs font-semibold text-white">
										{i.name}
									</p>
									<p className="text-[10px] capitalize text-muted">
										{i.type} · {i.stage_required}+
									</p>
									<div className="mt-2">
										{isOwned ? (
											<button
												onClick={() =>
													act.mutate({ action: "equip", name: i.name })
												}
												className={cn(
													"w-full rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
													isEquipped
														? "bg-gold text-ink"
														: "border border-line bg-surface-2 text-white",
												)}
											>
												{isEquipped ? (
													<>
														<Check className="mr-0.5 inline h-3 w-3" />
														Equipped
													</>
												) : (
													"Equip"
												)}
											</button>
										) : (
											<button
												onClick={() =>
													act.mutate({ action: "buyItem", itemId: i.id })
												}
												disabled={locked || bones < i.bone_cost}
												className="w-full rounded-lg border border-line bg-surface-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
											>
												{locked ? "🔒 Locked" : `${i.bone_cost} 🦴`}
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				))}

			{tab === "adventures" &&
				(adventures.length === 0 ? (
					<EmptyState icon="🗺️" title="No adventures yet" />
				) : (
					<div className="space-y-2.5">
						{adventures.map((a) => {
							const done = pet.adventures.includes(a.theme);
							return (
								<div
									key={a.id}
									className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
								>
									<span className="text-2xl">{a.emoji}</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<p className="text-sm font-semibold text-white">
												{a.theme}
											</p>
											{done && <Badge color="green">done</Badge>}
										</div>
										<p className="mt-0.5 text-xs text-muted">{a.description}</p>
										<p className="mt-1 flex items-center gap-3 text-[11px] text-muted">
											<span className="flex items-center gap-1">
												<Clock className="h-3 w-3" />
												{a.duration_minutes}m
											</span>
											<span>{a.bone_cost} 🦴</span>
											<span className="text-gold/70">
												+{a.reward_amount} {a.reward_type}
											</span>
										</p>
									</div>
									<Button
										size="sm"
										variant={done ? "secondary" : "primary"}
										disabled={bones < a.bone_cost}
										onClick={() =>
											act.mutate({ action: "adventure", adventureId: a.id })
										}
									>
										{done ? (
											"Again"
										) : (
											<>
												<Backpack className="mr-1 h-3.5 w-3.5" />
												Go
											</>
										)}
									</Button>
								</div>
							);
						})}
					</div>
				))}

			{tab === "log" &&
				(pet.mood_log.length === 0 ? (
					<EmptyState
						icon="📊"
						title="No mood history yet"
						description="Interact with your pet to start tracking."
					/>
				) : (
					<div className="rounded-2xl border border-line bg-surface p-4">
						<div
							className="mb-4 flex items-end justify-between gap-1"
							style={{ height: 80 }}
						>
							{[...pet.mood_log].reverse().map((m, i) => {
								const score: Record<string, number> = {
									happy: 60,
									excited: 90,
									sleepy: 30,
									hungry: 40,
									sad: 20,
								};
								return (
									<div
										key={i}
										className="flex flex-1 flex-col items-center gap-1"
									>
										<div
											className="w-full rounded-t bg-gradient-to-t from-gold/40 to-gold"
											style={{ height: `${score[m.mood] ?? 50}%` }}
										/>
										<span className="text-[9px]">{MOOD_EMOJI[m.mood]}</span>
									</div>
								);
							})}
						</div>
						<div className="space-y-1.5">
							{[...pet.mood_log]
								.reverse()
								.slice(0, 6)
								.map((m, i) => (
									<div
										key={i}
										className="flex items-center justify-between text-xs"
									>
										<span className="text-muted">
											{new Date(m.time).toLocaleDateString()}{" "}
											{new Date(m.time).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
										<span className="capitalize text-white/80">
											{m.mood} {MOOD_EMOJI[m.mood]}
										</span>
									</div>
								))}
						</div>
					</div>
				))}

			{renaming && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
					onClick={() => setRenaming(false)}
				>
					<div
						className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="mb-3 text-sm font-semibold text-white">
							Rename your pet
						</h3>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={pet.name}
							autoFocus
							className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-white focus:border-gold/50 focus:outline-none"
						/>
						<div className="mt-3 flex gap-2">
							<Button
								className="flex-1"
								onClick={() => {
									act.mutate({ action: "rename", name });
									setRenaming(false);
								}}
								disabled={!name.trim()}
							>
								Save
							</Button>
							<Button variant="secondary" onClick={() => setRenaming(false)}>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
