/**
 * Auth boundary and boot sequence.
 *
 * Flow: resolve session → (unconfigured | signed out | onboarding | app).
 *
 * Everything about identity is decided here and nowhere else:
 *   - The browser only ever talks to Supabase Auth (to obtain a session) and to
 *     `/api/session` (to learn what that session can do).
 *   - Whether a profile exists, whether onboarding is complete, and which
 *     capabilities the schema supports all come from the server in one call,
 *     replacing fourteen probe queries fired on every auth event.
 *   - A route is never rendered "signed in" optimistically. If the session is not
 *     confirmed, children are not mounted, so no component can render a half
 *     state that looks like data.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, KeyRound, Loader2, LockKeyhole, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { getSupabase } from "#/integrations/supabase/client";
import { envMissing, isConfigured } from "#/integrations/supabase/env";
import { api, ApiClientError } from "#/lib/client";
import type { SessionResponse } from "#/server/handlers/session";
import { LogoHorizontal } from "./Brand";
import { AppShell } from "./AppShell";
import { cn } from "#/lib/utils";

type Gate =
	| { kind: "loading" }
	| { kind: "setup"; reason: string; missing: string[] }
	| { kind: "signed-out" }
	| { kind: "onboarding"; session: SessionResponse }
	| { kind: "app"; session: SessionResponse };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export function EntryShell({ children }: { children: ReactNode }) {
	const [gate, setGate] = useState<Gate>({ kind: "loading" });
	const [recovering, setRecovering] = useState(false);
	const inFlight = useRef(false);

	const load = useCallback(async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			if (!isConfigured) {
				setGate({ kind: "setup", reason: `Missing ${envMissing.join(" and ")}.`, missing: envMissing });
				return;
			}
			const client = getSupabase();
			if (!client) {
				setGate({ kind: "setup", reason: "The Supabase browser client could not be created.", missing: ["Supabase client"] });
				return;
			}

			// The local check only decides whether to bother the server; the server
			// re-validates the token with GoTrue, so this can never grant access.
			const { data } = await client.auth.getSession();
			if (!data.session) {
				setGate({ kind: "signed-out" });
				return;
			}

			let session: SessionResponse;
			try {
				session = await api.get<SessionResponse>("session");
			} catch (error) {
				if (error instanceof ApiClientError && error.code === "unauthorized") {
					await client.auth.signOut({ scope: "local" });
					setGate({ kind: "signed-out" });
					return;
				}
				setGate({
					kind: "setup",
					reason: error instanceof ApiClientError && error.code === "dependency_unavailable" ? "The FYK server is not reachable or not configured." : "Your session could not be verified. Try again.",
					missing: ["Server session"],
				});
				return;
			}

			if (!session.configured) {
				setGate({ kind: "setup", reason: "The server cannot reach Supabase. Check SUPABASE_URL / SUPABASE_ANON_KEY in the server environment.", missing: ["Server Supabase config"] });
				return;
			}
			if (!session.signedIn) {
				setGate({ kind: "signed-out" });
				return;
			}
			setGate({ kind: session.needsOnboarding ? "onboarding" : "app", session });
		} finally {
			inFlight.current = false;
		}
	}, []);

	useEffect(() => {
		void load();
		const client = getSupabase();
		if (!client) return;
		const { data } = client.auth.onAuthStateChange((event) => {
			if (event === "PASSWORD_RECOVERY") setRecovering(true);
			// Deferred so it does not contend with Supabase's own auth-state lock.
			window.setTimeout(() => void load(), 0);
		});
		return () => data.subscription.unsubscribe();
	}, [load]);

	const signOut = useCallback(async () => {
		await getSupabase()?.auth.signOut({ scope: "local" });
		setGate({ kind: "signed-out" });
	}, []);

	const value = useMemo(
		() => ({
			refresh: load,
			signOut,
		}),
		[load, signOut],
	);

	if (recovering) {
		return (
			<PasswordRecovery
				onDone={async () => {
					setRecovering(false);
					await signOut();
					void load();
				}}
			/>
		);
	}
	if (gate.kind === "loading") return <BootLoading />;
	if (gate.kind === "setup") return <SetupRequired reason={gate.reason} missing={gate.missing} onRetry={() => void load()} />;
	if (gate.kind === "signed-out") return <AuthScreens onDone={() => void load()} />;
	if (gate.kind === "onboarding") return <Onboarding onDone={() => void load()} />;

	return (
		<AppShell session={gate.session} refresh={value.refresh} signOut={value.signOut}>
			{children}
		</AppShell>
	);
}

/* ------------------------------------------------------------------ boot ---- */

function BootLoading() {
	return (
		<div className="grid min-h-[100svh] place-items-center bg-canvas px-6 text-ink">
			<div className="flex flex-col items-center gap-5">
				<LogoHorizontal className="w-52" />
				<span className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
					<Loader2 className="h-4 w-4 animate-spin text-gold" />
					Checking your session
				</span>
			</div>
		</div>
	);
}

function SetupRequired({ reason, missing, onRetry }: { reason: string; missing: string[]; onRetry: () => void }) {
	return (
		<div className="grid min-h-[100svh] place-items-center bg-canvas px-6 py-12 text-ink">
			<div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-pop)] sm:p-8">
				<span className="inline-flex items-center gap-2 rounded-full border border-live/40 bg-live/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-live">
					<AlertTriangle className="h-3.5 w-3.5" />
					Setup required
				</span>
				<h1 className="mt-4 text-[26px] font-bold leading-tight tracking-[-0.02em]">FYK is not connected yet</h1>
				<p className="mt-2 text-[14.5px] leading-relaxed text-muted">{reason}</p>
				{missing.length > 0 && (
					<ul className="mt-4 space-y-1.5 rounded-2xl border border-line bg-surface-2 p-4">
						{missing.map((item) => (
							<li key={item} className="flex items-start gap-2 text-[13px] text-ink-2">
								<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-live" />
								<span className="font-mono text-[12.5px]">{item}</span>
							</li>
						))}
					</ul>
				)}
				<ol className="mt-5 space-y-2 text-[13px] leading-relaxed text-muted">
					<li>1. Copy <code className="text-gold">.env.example</code> to <code className="text-gold">.env.local</code> and fill in the Supabase values (browser and server).</li>
					<li>2. Apply <code className="text-gold">supabase/migrations</code> in filename order — see the README there.</li>
					<li>3. Retry. Nothing below this screen will render as a placeholder while it waits.</li>
				</ol>
				<button type="button" onClick={onRetry} className="press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2">
					<RefreshCw className="h-4 w-4" /> Retry
				</button>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------- auth forms ---- */

const signInSchema = z.object({
	email: z.string().trim().min(1).regex(EMAIL_RE, "Enter a valid email address."),
	password: z.string().min(10, "Use at least 10 characters."),
});

const signUpSchema = z.object({
	email: z.string().trim().min(1).regex(EMAIL_RE, "Enter a valid email address."),
	password: z.string().min(10, "Use at least 10 characters."),
	adult: z.boolean().refine((value) => value, "You must confirm you are 18 or older."),
	terms: z.boolean().refine((value) => value, "You must accept the community guidelines."),
});

function AuthScreens({ onDone }: { onDone: () => void }) {
	const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [adult, setAdult] = useState(false);
	const [terms, setTerms] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const submit = useCallback(
		async (event: React.FormEvent) => {
			event.preventDefault();
			setError("");
			setNotice("");
			const client = getSupabase();
			if (!client) return setError("Supabase is not configured.");
			setBusy(true);
			try {
				if (mode === "signin") {
					const parsed = signInSchema.safeParse({ email, password });
					if (!parsed.success) return setError(parsed.error.issues[0].message);
					const { error: authError } = await client.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
					if (authError) return setError(friendlyAuthError(authError.message));
					onDone();
				} else if (mode === "signup") {
					const parsed = signUpSchema.safeParse({ email, password, adult, terms });
					if (!parsed.success) return setError(parsed.error.issues[0].message);
					const { data, error: authError } = await client.auth.signUp({
						email: parsed.data.email,
						password: parsed.data.password,
						options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
					});
					if (authError) return setError(friendlyAuthError(authError.message));
					if (data.session) onDone();
					else setNotice(`We sent a confirmation link to ${parsed.data.email}. Confirm it, then sign in.`);
				} else {
					if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
					const { error: authError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?mode=recover` });
					if (authError) return setError(friendlyAuthError(authError.message));
					setNotice("If that address has an account, a reset link is on its way.");
					setMode("signin");
				}
			} catch {
				setError("Network error. Check your connection and try again.");
			} finally {
				setBusy(false);
			}
		},
		[adult, email, mode, onDone, password, terms],
	);

	return (
		<div className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-canvas px-5 py-10 text-ink">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,var(--color-gold-ghost),transparent)]" />
			<div className="relative w-full max-w-[430px]">
				<div className="mb-7 flex flex-col items-start gap-5">
					<LogoHorizontal className="w-44" />
					<div>
						<h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[36px]">
							{mode === "signin" ? "Welcome back." : mode === "signup" ? "Join the kingdom." : "Reset your password."}
						</h1>
						<p className="mt-2 text-[14.5px] leading-relaxed text-muted">
							Nearby people, a live Board, real conversations. Adults only, and your location stays approximate by default.
						</p>
					</div>
				</div>

				<form onSubmit={submit} className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)] sm:p-6" noValidate>
					<div className="space-y-4">
						<Field label="Email" htmlFor="auth-email">
							<div className="relative">
								<Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
								<input
									id="auth-email"
									type="email"
									inputMode="email"
									autoComplete="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder="you@example.com"
									className="entry-input pl-10"
								/>
							</div>
						</Field>

						{mode !== "reset" && (
							<Field label="Password" htmlFor="auth-password">
								<div className="relative">
									<LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
									<input
										id="auth-password"
										type="password"
										autoComplete={mode === "signin" ? "current-password" : "new-password"}
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										placeholder="At least 10 characters"
										className="entry-input pl-10"
									/>
								</div>
							</Field>
						)}

						{mode === "signup" && (
							<div className="space-y-2.5">
								<CheckLine checked={adult} onChange={setAdult} label="I am 18 or older." />
								<CheckLine checked={terms} onChange={setTerms} label="I accept the community guidelines: no harassment, no sharing other people's images, no underage content." />
							</div>
						)}
					</div>

					{error && (
						<p role="alert" className="mt-4 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] text-live">
							{error}
						</p>
					)}
					{notice && (
						<p role="status" className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-300">
							{notice}
						</p>
					)}

					<button type="submit" disabled={busy} className="press mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2 disabled:opacity-60">
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
						{mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
					</button>

					<div className="mt-4 flex items-center justify-between text-[12.5px]">
						{mode === "signin" ? (
							<button type="button" onClick={() => setMode("signup")} className="font-semibold text-gold hover:underline">
								Create an account
							</button>
						) : (
							<button type="button" onClick={() => setMode("signin")} className="font-semibold text-gold hover:underline">
								I already have an account
							</button>
						)}
						{mode !== "reset" && (
							<button type="button" onClick={() => setMode("reset")} className="text-muted hover:text-ink">
								Forgot password?
							</button>
						)}
					</div>
				</form>

				<ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-faint">
					<li className="inline-flex items-center gap-1.5">
						<ShieldCheck className="h-3.5 w-3.5 text-gold/70" /> 18+ only, age verified at sign-up
					</li>
					<li className="inline-flex items-center gap-1.5">
						<KeyRound className="h-3.5 w-3.5 text-gold/70" /> Session in cookies, not localStorage
					</li>
				</ul>
			</div>
		</div>
	);
}

/* ----------------------------------------------------------- onboarding ---- */

const onboardingSchema = z
	.object({
		displayName: z.string().trim().min(2, "Use at least 2 characters for your display name.").max(40),
		handle: z.string().trim().regex(/^[a-z0-9_]{3,24}$/, "Handle must be 3-24 letters, numbers or underscores."),
		city: z.string().trim().min(1, "Enter your city.").max(80),
		dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth."),
		interests: z.array(z.string()).max(15).default([]),
		lookingFor: z.array(z.string()).max(6).default([]),
		latitude: z.number().min(-90).max(90).optional(),
		longitude: z.number().min(-180).max(180).optional(),
	})
	.refine((value) => {
		const age = ageFromDob(value.dob);
		return age !== null && age >= 18;
	}, "FYK is for adults aged 18 and over.");

export function ageFromDob(dob: string, now = new Date()): number | null {
	const birth = new Date(`${dob}T00:00:00`);
	if (Number.isNaN(birth.getTime())) return null;
	let years = now.getFullYear() - birth.getFullYear();
	const before = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
	if (before) years -= 1;
	return years;
}

const INTEREST_OPTIONS = ["fitness", "music", "travel", "film", "gaming", "art", "food", "reading", "hiking", "nightlife", "sports", "photography"];
const LOOKING_FOR_OPTIONS = ["dating", "relationship", "friends", "hookup", "networking"];

function Onboarding({ onDone }: { onDone: () => void }) {
	const [step, setStep] = useState(0);
	const [displayName, setDisplayName] = useState("");
	const [handle, setHandle] = useState("");
	const [city, setCity] = useState("");
	const [dob, setDob] = useState("");
	const [interests, setInterests] = useState<string[]>([]);
	const [lookingFor, setLookingFor] = useState<string[]>([]);
	const [coords, setCoords] = useState<{ latitude?: number; longitude?: number; note?: string }>({});
	const [locating, setLocating] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const maxDob = useMemo(() => {
		const date = new Date();
		date.setFullYear(date.getFullYear() - 18);
		return date.toISOString().slice(0, 10);
	}, []);

	const askLocation = () => {
		setLocating(true);
		if (!("geolocation" in navigator)) {
			setLocating(false);
			setCoords({ note: "This browser has no location. You can still use FYK with your city." });
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setLocating(false);
				setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
			},
			(reason) => {
				setLocating(false);
				setCoords({ note: reason.code === 1 ? "Location blocked in your browser. City-only search will be used." : "No fix right now. City-only search will be used." });
			},
			{ timeout: 8000, maximumAge: 600_000, enableHighAccuracy: false },
		);
	};

	const next = () => {
		setError("");
		const parsed = onboardingSchema.safeParse({ displayName, handle: handle.toLowerCase(), city, dob, interests, lookingFor, latitude: coords.latitude, longitude: coords.longitude });
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		setStep(2);
	};

	const finish = async () => {
		setBusy(true);
		setError("");
		try {
			await api.post("onboarding", {
				displayName: displayName.trim(),
				handle: handle.trim().toLowerCase(),
				city: city.trim(),
				dob,
				interests,
				lookingFor,
				latitude: coords.latitude,
				longitude: coords.longitude,
			});
			onDone();
		} catch (submitError) {
			setError(submitError instanceof ApiClientError ? submitError.message : "We could not save your profile. Try again.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="min-h-[100svh] bg-canvas px-5 py-8 text-ink">
			<main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-5xl flex-col">
				<div className="flex items-center justify-between gap-4">
					<LogoHorizontal className="w-40" />
					<span className="text-[12px] font-semibold text-muted">Step {step + 1} of 3</span>
				</div>
				<div className="mt-5 h-1 overflow-hidden rounded-full bg-surface-3">
					<div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${((step + 1) / 3) * 100}%` }} />
				</div>

				<div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,470px)]">
					<section className="max-w-xl">
						<p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
							{step === 0 ? "The basics" : step === 1 ? "What you want" : "Where you are"}
						</p>
						<h1 className="mt-3 text-[34px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[44px]">
							{step === 0 ? "Start with what people should know." : step === 1 ? "Be specific. It saves everyone time." : "Approximate is enough."}
						</h1>
						<p className="mt-4 text-[15px] leading-relaxed text-muted">
							{step === 0
								? "Your date of birth is used for the 18+ gate and stored privately. Everyone else sees only the age we derive from it."
								: step === 1
									? "Interests drive what shows up on your cards. Looking-for is the one thing people most want to know."
									: "FYK stores a coarsened position — about a 250 m square — never a precise fix. You can skip this and search by city instead."}
						</p>
					</section>

					<section className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)] sm:p-6">
						{step === 0 && (
							<div className="space-y-4">
								<label className="block">
									<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Display name</span>
									<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" placeholder="What people call you" className="entry-input" />
								</label>
								<label className="block">
									<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Handle</span>
									<div className="relative">
										<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
										<input value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="your_handle" className="entry-input pl-8" />
									</div>
								</label>
								<div className="grid gap-4 sm:grid-cols-2">
									<label className="block">
										<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Date of birth</span>
										<input type="date" value={dob} max={maxDob} onChange={(event) => setDob(event.target.value)} className="entry-input" />
									</label>
									<label className="block">
										<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">City</span>
										<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Valletta" className="entry-input" />
									</label>
								</div>
								{ageFromDob(dob) !== null && (
									<p className="text-[12px] text-faint">Visible to others: {ageFromDob(dob)} years old. Nothing else about your birth date.</p>
								)}
								{error && <p role="alert" className="text-[13px] text-live">{error}</p>}
								<button type="button" onClick={next} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2">
									Continue <ArrowRight className="h-4 w-4" />
								</button>
							</div>
						)}

						{step === 1 && (
							<div className="space-y-5">
								<div>
									<p className="mb-2 text-[12.5px] font-semibold text-ink-2">Interests (up to 15)</p>
									<div className="flex flex-wrap gap-2">
										{INTEREST_OPTIONS.map((option) => (
											<button
												key={option}
												type="button"
												aria-pressed={interests.includes(option)}
												onClick={() => setInterests((current) => (current.includes(option) ? current.filter((entry) => entry !== option) : current.length >= 15 ? current : [...current, option]))}
												className={cn("press h-9 rounded-full border px-3 text-[12.5px] font-medium", interests.includes(option) ? "border-gold/60 bg-gold-ghost text-gold" : "border-line bg-surface-2 text-ink-2")}
											>
												{option}
											</button>
										))}
									</div>
								</div>
								<div>
									<p className="mb-2 text-[12.5px] font-semibold text-ink-2">Looking for</p>
									<div className="flex flex-wrap gap-2">
										{LOOKING_FOR_OPTIONS.map((option) => (
											<button
												key={option}
												type="button"
												aria-pressed={lookingFor.includes(option)}
												onClick={() => setLookingFor((current) => (current.includes(option) ? current.filter((entry) => entry !== option) : [...current, option]))}
												className={cn("press h-9 rounded-full border px-3 text-[12.5px] font-medium", lookingFor.includes(option) ? "border-gold/60 bg-gold-ghost text-gold" : "border-line bg-surface-2 text-ink-2")}
											>
												{option}
											</button>
										))}
									</div>
								</div>
								<div className="flex gap-2">
									<button type="button" onClick={() => setStep(0)} className="press h-12 rounded-full border border-line px-5 text-[14px] font-semibold text-ink-2 hover:text-ink">Back</button>
									<button type="button" onClick={() => setStep(2)} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2">
										Continue <ArrowRight className="h-4 w-4" />
									</button>
								</div>
							</div>
						)}

						{step === 2 && (
							<div className="space-y-4">
								<div className="space-y-3">
									{[
										[ShieldCheck, "Adults only", "Your birth date is checked at sign-up and enforced in the database."],
										[LockKeyhole, "Location stays coarse", "We store a ~250 m grid cell so distance can be shown without tracking."],
									].map(([Icon, title, body]) => {
										const ItemIcon = Icon as typeof ShieldCheck;
										return (
											<div key={title as string} className="flex gap-3 border-b border-line-soft pb-3 last:border-0">
												<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-ghost text-gold">
													<ItemIcon className="h-4 w-4" />
												</span>
												<div>
													<p className="text-[13.5px] font-semibold text-ink">{title as string}</p>
													<p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{body as string}</p>
												</div>
											</div>
										);
									})}
								</div>

								{coords.latitude != null ? (
									<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-300">
										Approximate location captured. It will be snapped to the coarse grid before saving.
									</p>
								) : (
									<button type="button" onClick={askLocation} disabled={locating} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface-2 text-[14px] font-semibold text-ink-2 hover:border-gold/40">
										{locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Use my location
									</button>
								)}
								{coords.note && <p className="text-[12.5px] text-muted">{coords.note}</p>}
								{error && <p role="alert" className="text-[13px] text-live">{error}</p>}

								<div className="flex gap-2">
									<button type="button" onClick={() => setStep(1)} className="press h-12 rounded-full border border-line px-5 text-[14px] font-semibold text-ink-2 hover:text-ink">Back</button>
									<button type="button" onClick={() => void finish()} disabled={busy} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2 disabled:opacity-60">
										{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enter FYK
									</button>
								</div>
								<button type="button" onClick={() => void finish()} disabled={busy} className="w-full text-center text-[12px] text-faint hover:text-muted">
									Skip location — search by city instead
								</button>
							</div>
						)}
					</section>
				</div>
			</main>
		</div>
	);
}

function friendlyAuthError(message: string): string {
	const lower = message.toLowerCase();
	if (lower.includes("invalid login credentials")) return "That email and password do not match an account.";
	if (lower.includes("email not confirmed")) return "Confirm your email first — the link is in your inbox.";
	if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Wait a minute and try again.";
	if (lower.includes("already registered") || lower.includes("already been registered")) return "That email already has an account. Sign in instead.";
	if (lower.includes("password")) return "That password does not meet the minimum length.";
	return "We couldn't complete that right now. Try again.";
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
	return (
		<label className="block" htmlFor={htmlFor}>
			<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>
			{children}
		</label>
	);
}

function CheckLine({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
	return (
		<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-3">
			<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
			<span className="text-[12.5px] leading-relaxed text-ink-2">{label}</span>
		</label>
	);
}

function PasswordRecovery({ onDone }: { onDone: () => Promise<void> | void }) {
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		const parsed = z.object({ password: z.string().min(10, "Use at least 10 characters."), confirm: z.string() }).refine((data) => data.password === data.confirm, { message: "The passwords do not match.", path: ["confirm"] }).safeParse({ password, confirm });
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		const client = getSupabase();
		if (!client) return setError("Supabase is not configured.");
		setBusy(true);
		const { error: updateError } = await client.auth.updateUser({ password: parsed.data.password });
		setBusy(false);
		if (updateError) return setError(friendlyAuthError(updateError.message));
		await onDone();
	};

	return (
		<div className="grid min-h-[100svh] place-items-center bg-canvas px-5 text-ink">
			<form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6">
				<h1 className="text-[22px] font-bold tracking-[-0.02em]">Choose a new password</h1>
				<p className="mt-1.5 text-[13px] text-muted">You are signed in from the reset link. Set a password and continue.</p>
				<div className="mt-5 space-y-3">
					<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="entry-input" />
					<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm password" className="entry-input" />
				</div>
				{error && <p role="alert" className="mt-3 text-[13px] text-live">{error}</p>}
				<button type="submit" disabled={busy} className={cn("press mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black")}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Update password
				</button>
			</form>
		</div>
	);
}
