"use client";

import { useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Camera,
	Check,
	Crown,
	MapPin,
	PartyPopper,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client";
import {
	BODY_TYPES,
	LANGUAGES,
	LOOKING_FOR,
	POSITIONS,
	TAG_CATEGORIES,
	TRIBES,
} from "@/lib/constants";
import { useAppStore } from "@/lib/store";
import { cn, gradient } from "@/lib/utils";

const PHOTO_POOL = [
	"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&q=80",
	"https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80",
	"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&q=80",
	"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
];

const STEPS = [
	"Photos",
	"About",
	"Tribes",
	"Interests",
	"Looking for",
	"Location",
	"Done",
];

export function OnboardingFlow({ name }: { name: string }) {
	const navigate = useNavigate();
	const pushToast = useAppStore((s) => s.pushToast);
	const [step, setStep] = useState(0);
	const [saving, setSaving] = useState(false);
	const [data, setData] = useState({
		photos: [] as string[],
		bio: "",
		age: null as number | null,
		height: null as number | null,
		body_type: "",
		occupation: "",
		tribes: [] as string[],
		interests: [] as string[],
		looking_for: [] as string[],
		position: [] as string[],
		languages: ["English"] as string[],
		city: "New York",
	});
	const [bioOptions, setBioOptions] = useState<string[] | null>(null);

	function toggle(
		field: "tribes" | "interests" | "looking_for" | "position",
		value: string,
		max?: number,
	) {
		setData((d) => {
			const cur = d[field];
			if (cur.includes(value))
				return { ...d, [field]: cur.filter((v) => v !== value) };
			if (max && cur.length >= max) return d;
			return { ...d, [field]: [...cur, value] };
		});
	}

	async function generateBio() {
		const r = await api<{ options: string[] }>("/api/ai", {
			method: "POST",
			body: {
				action: "bioWriter",
				pseudo: name,
				occupation: data.occupation,
				interests: data.interests,
				tribes: data.tribes,
				looking_for: data.looking_for,
				age: data.age,
			},
		});
		setBioOptions(r.options);
	}

	async function finish() {
		setSaving(true);
		try {
			const res = await api<{ profile: unknown }>("/api/profile", {
				method: "PUT",
				body: {
					pseudo: name,
					description: data.bio,
					age: data.age,
					height: data.height,
					body_type: data.body_type,
					occupation: data.occupation,
					tribes: data.tribes,
					interests: data.interests,
					looking_for: data.looking_for,
					position: data.position,
					languages: data.languages,
					photos: data.photos,
					city: data.city,
					onboarding_done: true,
				},
			});
			void res;
			pushToast("Welcome to FYK 👑");
			await navigate({ to: "/discover" });
		} catch {
			pushToast("Could not save — continuing anyway", "error");
			await navigate({ to: "/discover" });
		} finally {
			setSaving(false);
		}
	}

	const canNext = [
		data.photos.length > 0,
		data.bio.trim().length > 10,
		data.tribes.length > 0,
		data.interests.length >= 3,
		data.looking_for.length > 0,
		true,
		true,
	][step];

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
			{/* header */}
			<div className="mb-6 flex items-center gap-2">
				<Crown className="h-5 w-5 text-gold" />
				<span className="text-gradient-gold font-bold">FYK</span>
			</div>

			{/* progress */}
			<div className="mb-6 flex gap-1">
				{STEPS.map((_, i) => (
					<div
						key={i}
						className={cn(
							"h-1 flex-1 rounded-full transition-colors",
							i <= step ? "bg-gold" : "bg-white/10",
						)}
					/>
				))}
			</div>

			<p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">
				Step {step + 1} of {STEPS.length}
			</p>
			<h1 className="mb-1 text-2xl font-bold text-white">{STEPS[step]}</h1>

			<div className="flex-1 py-6">
				{step === 0 && (
					<>
						<p className="mb-4 text-sm text-muted">
							Add at least one photo. Profiles with 3+ photos get 2.4x more
							taps.
						</p>
						<div className="grid grid-cols-3 gap-2">
							{PHOTO_POOL.map((p) => {
								const sel = data.photos.includes(p);
								return (
									<button
										key={p}
										onClick={() =>
											setData((d) => ({
												...d,
												photos: sel
													? d.photos.filter((x) => x !== p)
													: d.photos.length >= 6
														? d.photos
														: [...d.photos, p],
											}))
										}
										className={cn(
											"relative overflow-hidden rounded-2xl border-2",
											sel ? "border-gold" : "border-line",
										)}
									>
										<img
											src={p}
											alt=""
											className="aspect-square w-full object-cover"
										/>
										{sel && (
											<span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-ink">
												<Check className="h-3.5 w-3.5" strokeWidth={3} />
											</span>
										)}
									</button>
								);
							})}
						</div>
						<div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-line p-4 text-muted">
							<Camera className="h-5 w-5" />
							<p className="text-xs">
								Camera upload available in the mobile app
							</p>
						</div>
					</>
				)}

				{step === 1 && (
					<>
						<div className="mb-3 flex items-center justify-between">
							<p className="text-sm text-muted">Tell people who you are.</p>
							<button
								onClick={generateBio}
								className="flex items-center gap-1 text-xs text-gold hover:text-gold-soft"
							>
								<Sparkles className="h-3 w-3" /> Write with AI
							</button>
						</div>
						<textarea
							value={data.bio}
							onChange={(e) => setData((d) => ({ ...d, bio: e.target.value }))}
							rows={4}
							maxLength={500}
							placeholder="I'm into…"
							className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
						/>
						{bioOptions && (
							<div className="mt-2 space-y-1.5">
								{bioOptions.map((b, i) => (
									<button
										key={i}
										onClick={() => {
											setData((d) => ({ ...d, bio: b }));
											setBioOptions(null);
										}}
										className="w-full rounded-xl border border-gold/25 bg-gold/[0.06] p-3 text-left text-xs text-white/85"
									>
										{b}
									</button>
								))}
							</div>
						)}
						<div className="mt-4 grid grid-cols-3 gap-2">
							<input
								type="number"
								placeholder="Age"
								value={data.age ?? ""}
								onChange={(e) =>
									setData((d) => ({
										...d,
										age: Number(e.target.value) || null,
									}))
								}
								className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
							/>
							<input
								type="number"
								placeholder="Height cm"
								value={data.height ?? ""}
								onChange={(e) =>
									setData((d) => ({
										...d,
										height: Number(e.target.value) || null,
									}))
								}
								className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
							/>
							<input
								placeholder="Job"
								value={data.occupation}
								onChange={(e) =>
									setData((d) => ({ ...d, occupation: e.target.value }))
								}
								className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
							/>
						</div>
						<p className="mt-4 mb-2 text-xs font-medium text-muted">
							Body type
						</p>
						<div className="flex flex-wrap gap-1.5">
							{BODY_TYPES.map((b) => (
								<button
									key={b}
									onClick={() =>
										setData((d) => ({
											...d,
											body_type: d.body_type === b ? "" : b,
										}))
									}
									className={cn(
										"rounded-full border px-3 py-1.5 text-xs",
										data.body_type === b
											? "border-gold/50 bg-gold/15 text-gold-soft"
											: "border-line bg-surface-2 text-muted",
									)}
								>
									{b}
								</button>
							))}
						</div>
					</>
				)}

				{step === 2 && (
					<>
						<p className="mb-4 text-sm text-muted">
							Pick up to 3. Your primary tribe drives discovery.
						</p>
						<div className="grid grid-cols-2 gap-2">
							{TRIBES.map((t) => {
								const sel = data.tribes.includes(t);
								return (
									<button
										key={t}
										onClick={() => toggle("tribes", t, 3)}
										className={cn(
											"flex items-center gap-2 rounded-2xl border p-3 text-left transition-colors",
											sel
												? "border-gold/50 bg-gold/15"
												: "border-line bg-surface-2",
										)}
									>
										<div
											className="flex h-9 w-9 items-center justify-center rounded-xl text-sm"
											style={{ background: gradient(t) }}
										>
											{[
												"Bear",
												"Twink",
												"Otter",
												"Polar",
												"Jock",
												"Geek",
												"Leather",
												"Daddy",
												"Muscle",
												"Chub",
											].indexOf(t) >= 0
												? [
														"🐻",
														"✨",
														"🦦",
														"🧊",
														"🏈",
														"🎮",
														"🖤",
														"🥃",
														"💪",
														"🐻‍❄️",
													][
														[
															"Bear",
															"Twink",
															"Otter",
															"Polar",
															"Jock",
															"Geek",
															"Leather",
															"Daddy",
															"Muscle",
															"Chub",
														].indexOf(t)
													]
												: "🌍"}
										</div>
										<span className="text-xs font-medium text-white">{t}</span>
									</button>
								);
							})}
						</div>
					</>
				)}

				{step === 3 && (
					<>
						<p className="mb-4 text-sm text-muted">
							Choose at least 3 — this powers your AI matches.
						</p>
						{Object.entries(TAG_CATEGORIES).map(
							([catName, tags]: [string, string[]]) => (
								<div key={catName} className="mb-4">
									<p className="mb-2 text-xs font-semibold text-muted">
										{catName}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{tags.map((t: string) => {
											const sel = data.interests.includes(t);
											return (
												<button
													key={t}
													onClick={() => toggle("interests", t, 15)}
													className={cn(
														"rounded-full border px-3 py-1.5 text-xs",
														sel
															? "border-gold/50 bg-gold/15 text-gold-soft"
															: "border-line bg-surface-2 text-muted",
													)}
												>
													{sel && "✓ "}
													{t}
												</button>
											);
										})}
									</div>
								</div>
							),
						)}
					</>
				)}

				{step === 4 && (
					<>
						<p className="mb-4 text-sm text-muted">
							What are you here for? Be honest — it improves matching 40%.
						</p>
						<div className="mb-5 flex flex-wrap gap-1.5">
							{LOOKING_FOR.map((l) => {
								const sel = data.looking_for.includes(l);
								return (
									<button
										key={l}
										onClick={() => toggle("looking_for", l)}
										className={cn(
											"rounded-full border px-4 py-2 text-sm",
											sel
												? "border-gold/50 bg-gold/15 text-gold-soft"
												: "border-line bg-surface-2 text-muted",
										)}
									>
										{sel && "✓ "}
										{l}
									</button>
								);
							})}
						</div>
						<p className="mb-2 text-xs font-semibold text-muted">
							Position (optional)
						</p>
						<div className="flex flex-wrap gap-1.5">
							{POSITIONS.map((p) => {
								const sel = data.position.includes(p);
								return (
									<button
										key={p}
										onClick={() => toggle("position", p)}
										className={cn(
											"rounded-full border px-3 py-1.5 text-xs",
											sel
												? "border-blue-500/50 bg-blue-500/15 text-blue-300"
												: "border-line bg-surface-2 text-muted",
										)}
									>
										{p}
									</button>
								);
							})}
						</div>
					</>
				)}

				{step === 5 && (
					<>
						<p className="mb-4 text-sm text-muted">
							Where are you? This stays approximate — never exact.
						</p>
						<div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
							<MapPin className="h-5 w-5 shrink-0 text-gold" />
							<div className="flex-1">
								<p className="text-sm text-white">{data.city}</p>
								<p className="text-[11px] text-muted">
									Approximate location · shown as city only
								</p>
							</div>
							<Check className="h-4 w-4 text-emerald-400" />
						</div>
						<input
							value={data.city}
							onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))}
							placeholder="Change city"
							className="mb-4 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
						/>
						<p className="mb-2 text-xs font-semibold text-muted">Languages</p>
						<div className="flex flex-wrap gap-1.5">
							{LANGUAGES.map((l) => {
								const sel = data.languages.includes(l);
								return (
									<button
										key={l}
										onClick={() =>
											setData((d) => ({
												...d,
												languages: sel
													? d.languages.filter((x) => x !== l)
													: [...d.languages, l],
											}))
										}
										className={cn(
											"rounded-full border px-3 py-1.5 text-xs",
											sel
												? "border-gold/50 bg-gold/15 text-gold-soft"
												: "border-line bg-surface-2 text-muted",
										)}
									>
										{l}
									</button>
								);
							})}
						</div>
					</>
				)}

				{step === 6 && (
					<div className="flex flex-1 flex-col items-center justify-center text-center">
						<div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gold/15 animate-float">
							<PartyPopper className="h-10 w-10 text-gold" />
						</div>
						<h2 className="text-2xl font-bold text-white">
							You&apos;re in, {name}!
						</h2>
						<p className="mt-2 max-w-xs text-sm text-muted">
							Your profile is{" "}
							{data.photos.length > 0 &&
							data.tribes.length > 0 &&
							data.interests.length >= 3
								? "85%"
								: "60%"}{" "}
							complete. Every extra field makes you 3x more visible.
						</p>
						<div className="mt-6 w-full space-y-2">
							{[
								[`${data.photos.length} photos`, data.photos.length >= 3],
								[`${data.tribes.length} tribes`, data.tribes.length > 0],
								[
									`${data.interests.length} interests`,
									data.interests.length >= 3,
								],
								[
									`${data.looking_for.length} intents`,
									data.looking_for.length > 0,
								],
							].map(([label, ok]) => (
								<div
									key={label as string}
									className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5"
								>
									<span className="text-sm text-white/85">
										{label as string}
									</span>
									<span
										className={cn(
											"text-xs",
											ok ? "text-emerald-400" : "text-amber-400",
										)}
									>
										{ok ? "✓ Great" : "Add more"}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* nav */}
			<div className="flex gap-2">
				{step > 0 && (
					<Button
						variant="secondary"
						className="w-14 px-0"
						onClick={() => setStep(step - 1)}
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
				)}
				{step < STEPS.length - 1 ? (
					<Button
						className="flex-1"
						disabled={!canNext}
						onClick={() => setStep(step + 1)}
					>
						{canNext ? "Continue" : "Required to continue"}
					</Button>
				) : (
					<Button className="flex-1" onClick={finish} disabled={saving}>
						{saving ? (
							<Spinner className="border-ink/40 border-t-ink" />
						) : (
							"Enter FYK 👑"
						)}
					</Button>
				)}
			</div>
			{step < STEPS.length - 1 && (
				<button
					onClick={() => setStep(STEPS.length - 1)}
					className="mt-3 text-center text-xs text-muted hover:text-white"
				>
					Skip for now
				</button>
			)}
		</div>
	);
}
