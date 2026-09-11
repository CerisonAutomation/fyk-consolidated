import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Crown,
	MapPin,
	Camera,
	Sparkles,
} from "lucide-react";
import { getSupabase } from "#/integrations/supabase/client";
import { setPreferences } from "#/domains/settings/preferences";

export const Route = createFileRoute("/onboarding/")({
	component: OnboardingPage,
});

type Step = "welcome" | "name" | "location" | "photo" | "ready";

const STEPS: Step[] = ["welcome", "name", "location", "photo", "ready"];

const LOOKING_FOR_OPTIONS = [
	"Chat",
	"Friends",
	"Networking",
	"Right Now",
	"Relationship",
	"Hookup",
];

function OnboardingPage() {
	const [stepIndex, setStepIndex] = useState(0);
	const [starting, setStarting] = useState(false);
	const [name, setName] = useState("");
	const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);

	const step = STEPS[stepIndex];
	const progress = ((stepIndex + 1) / STEPS.length) * 100;

	// Pre-fill name from Supabase user metadata if available
	useEffect(() => {
		const client = getSupabase();
		if (!client) return;
		client.auth.getUser().then(({ data }) => {
			const metadata = data.user?.user_metadata;
			if (metadata?.first_name && !name) {
				setName(metadata.first_name);
			}
		});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const next = useCallback(() => {
		if (stepIndex < STEPS.length - 1) {
			setStepIndex((i) => i + 1);
		}
	}, [stepIndex]);

	const back = useCallback(() => {
		if (stepIndex > 0) {
			setStepIndex((i) => i - 1);
		}
	}, [stepIndex]);

	const handleFinish = useCallback(async () => {
		setStarting(true);
		setError(null);
		try {
			const client = getSupabase();
			if (!client) {
				throw new Error("Supabase is not configured");
			}

			// Get the current user
			const { data: { user }, error: userError } = await client.auth.getUser();
			if (userError || !user) {
				throw new Error("Not authenticated. Please sign in again.");
			}

			const now = new Date().toISOString();

			// 1. Save display name to profiles table
			const { error: profileError } = await client
				.from("profiles")
				.upsert({
					id: user.id,
					display_name: name.trim() || null,
					exposure_level: "clean",
					hide_distance: false,
					hide_online: false,
					incognito: false,
					age_verified_at: now,
					onboarding_completed_at: now,
					last_active_at: now,
					updated_at: now,
				}, { onConflict: "id" });

			if (profileError) {
				console.error("Profile save error:", profileError);
				// Non-fatal: continue with preferences save
			}

			// 2. Save onboarding preferences to Supabase user metadata
			await client.auth.updateUser({
				data: {
					onboarding_complete: true,
					display_name: name.trim() || null,
					looking_for: selectedInterests,
				},
			});

			// 3. Save preferences to local storage
			await setPreferences({
				onboardingComplete: true,
			});

			// 4. Redirect to the main app
			if (typeof window !== "undefined") {
				window.location.href = "/grid";
			}
		} catch (err) {
			setStarting(false);
			setError(
				err instanceof Error ? err.message : "Could not finish setup. Please try again.",
			);
			console.error("Couldn't finish setup", err);
		}
	}, [name, selectedInterests]);

	const toggleInterest = (opt: string) => {
		setSelectedInterests((prev) =>
			prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt],
		);
	};

	return (
		<div
			className="relative flex min-h-dvh flex-col overflow-hidden"
			style={{
				background:
					"linear-gradient(160deg, #0a0014 0%, #110022 25%, #000 50%, #0a0a0a 70%, #110808 100%)",
			}}
		>
			{/* Gradient overlays */}
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse 80% 50% at 50% 0%, rgba(234,179,8,0.06) 0%, transparent 60%)",
				}}
			/>

			{/* Progress bar */}
			<div className="relative z-10 px-6 pt-6">
				<div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
					<div
						className="h-full rounded-full transition-all duration-500"
						style={{
							width: `${progress}%`,
							background: "linear-gradient(90deg, #EAAB08, #F5D76E)",
						}}
					/>
				</div>
				<p className="mt-2 text-right text-[10px] text-white/30">
					{stepIndex + 1} / {STEPS.length}
				</p>
			</div>

			{/* Content */}
			<div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8">
				{step === "welcome" && (
					<div className="flex flex-col items-center gap-6 text-center">
						<div
							className="flex h-28 w-28 items-center justify-center rounded-2xl"
							style={{
								background:
									"linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))",
								border: "1px solid rgba(234,179,8,0.25)",
								boxShadow: "0 0 60px rgba(234,179,8,0.1)",
							}}
						>
							<Crown className="h-14 w-14 text-amber-400" strokeWidth={1.2} />
						</div>
						<div>
							<h1 className="font-heading text-4xl font-bold tracking-tight text-white">
								FYK
							</h1>
							<p className="mt-1 text-lg text-white/50">Find Your King</p>
						</div>
						<p className="max-w-xs text-sm leading-relaxed text-white/40">
							A premium dating experience with privacy at its core. Let's set up
							your profile.
						</p>
					</div>
				)}

				{step === "name" && (
					<div className="flex w-full max-w-sm flex-col items-center gap-6">
						<Sparkles className="h-10 w-10 text-amber-400/60" />
						<div className="text-center">
							<h2 className="font-display text-2xl font-semibold text-white">
								What's your name?
							</h2>
							<p className="mt-1 text-sm text-white/40">
								This will be shown on your profile
							</p>
						</div>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Your display name"
							className="w-full rounded-xl bg-white/5 px-4 py-3 text-center text-lg text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
							style={{ border: "1px solid rgba(255,255,255,0.1)" }}
							autoFocus
						/>
					</div>
				)}

				{step === "location" && (
					<div className="flex w-full max-w-sm flex-col items-center gap-6">
						<div
							className="flex h-16 w-16 items-center justify-center rounded-2xl"
							style={{
								background:
									"color-mix(in srgb, var(--accent-primary) 12%, transparent)",
							}}
						>
							<MapPin className="h-8 w-8 text-amber-400" />
						</div>
						<div className="text-center">
							<h2 className="font-display text-2xl font-semibold text-white">
								Enable location?
							</h2>
							<p className="mt-1 text-sm text-white/40">
								Find people nearby. You can change this later.
							</p>
						</div>
						<button
							type="button"
							onClick={async () => {
								if ("geolocation" in navigator) {
									navigator.geolocation.getCurrentPosition(async (pos) => {
										// Save location preference
										await setPreferences({ autoUpdateLocation: true });

										// Optionally save coarse location to profile
										const client = getSupabase();
										if (client) {
											const { data } = await client.auth.getUser();
											if (data.user) {
												await client.from("profiles").upsert({
													id: data.user.id,
													lat_coarse: Math.round(pos.coords.latitude * 100) / 100,
													lng_coarse: Math.round(pos.coords.longitude * 100) / 100,
													updated_at: new Date().toISOString(),
												}, { onConflict: "id" });
											}
										}
									});
								}
								next();
							}}
							className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
							style={{ border: "1px solid rgba(255,255,255,0.1)" }}
						>
							Allow location access
						</button>
						<button
							type="button"
							onClick={next}
							className="text-xs text-white/30 transition hover:text-white/50"
						>
							Skip for now
						</button>
					</div>
				)}

				{step === "photo" && (
					<div className="flex w-full max-w-sm flex-col items-center gap-6">
						<div
							className="flex h-16 w-16 items-center justify-center rounded-2xl"
							style={{
								background:
									"color-mix(in srgb, var(--accent-primary) 12%, transparent)",
							}}
						>
							<Camera className="h-8 w-8 text-amber-400" />
						</div>
						<div className="text-center">
							<h2 className="font-display text-2xl font-semibold text-white">
								Add a photo
							</h2>
							<p className="mt-1 text-sm text-white/40">
								Profiles with photos get 10x more attention
							</p>
						</div>
						<button
							type="button"
							className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 transition hover:bg-amber-500/10"
						>
							<Camera className="h-8 w-8 text-amber-400/60" />
							<span className="text-xs text-amber-400/60">Upload</span>
						</button>
						<button
							type="button"
							onClick={next}
							className="text-xs text-white/30 transition hover:text-white/50"
						>
							Skip for now
						</button>
					</div>
				)}

				{step === "ready" && (
					<div className="flex w-full max-w-sm flex-col items-center gap-6">
						<div className="text-center">
							<h2 className="font-display text-2xl font-semibold text-white">
								What are you looking for?
							</h2>
							<p className="mt-1 text-sm text-white/40">
								Select your interests (optional)
							</p>
						</div>
						<div className="flex flex-wrap justify-center gap-2">
							{LOOKING_FOR_OPTIONS.map((opt) => (
								<button
									key={opt}
									type="button"
									onClick={() => toggleInterest(opt)}
									className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
										selectedInterests.includes(opt)
											? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
											: "bg-white/5 text-white/40 ring-1 ring-white/10 hover:bg-white/10"
									}`}
								>
									{opt}
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Error message */}
			{error && (
				<div className="relative z-10 mx-8 mb-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400" role="alert">
					{error}
				</div>
			)}

			{/* Bottom actions */}
			<div className="relative z-10 shrink-0 px-8 pb-8 pt-4">
				{step !== "welcome" && step !== "ready" && (
					<button
						type="button"
						onClick={back}
						className="mb-3 flex items-center gap-1 text-xs text-white/30 transition hover:text-white/50"
					>
						<ChevronLeft className="h-3 w-3" /> Back
					</button>
				)}

				{step === "welcome" || step === "ready" ? (
					<button
						type="button"
						onClick={step === "ready" ? handleFinish : next}
						disabled={starting}
						className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
						style={{
							background: "linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
							color: "#000",
							boxShadow: "0 0 30px rgba(234,179,8,0.3)",
						}}
					>
						{starting ? (
							<span className="flex items-center gap-2">
								<span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
								Setting up...
							</span>
						) : (
							<>
								{step === "ready" ? "START EXPLORING" : "LET'S GO"}
								<ChevronRight className="h-4 w-4" />
							</>
						)}
					</button>
				) : (
					<button
						type="button"
						onClick={next}
						disabled={step === "name" && !name.trim()}
						className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100"
						style={{
							background: "linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
							color: "#000",
							boxShadow: "0 0 30px rgba(234,179,8,0.3)",
						}}
					>
						CONTINUE
						<ChevronRight className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);
}
