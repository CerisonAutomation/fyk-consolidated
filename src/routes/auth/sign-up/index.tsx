import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { requireSupabase } from "#/integrations/supabase/client";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import {
	Eye,
	EyeOff,
	Mail,
	Lock,
	User,
	ArrowRight,
	Shield,
	LockKeyhole,
} from "lucide-react";

export const Route = createFileRoute("/auth/sign-up/")({
	component: SignUpPage,
});

function SignUpPage() {
	const [firstName, setFirstName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const { user } = useSupabaseSession();
	const navigate = useNavigate();

	// Redirect if already signed in
	useEffect(() => {
		if (user) {
			navigate({ to: "/grid", replace: true });
		}
	}, [user, navigate]);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setLoading(true);
			setError(null);

			try {
				const { data, error: authError } = await requireSupabase().auth.signUp({
					email,
					password,
					options: {
						data: {
							first_name: firstName || undefined,
						},
					},
				});

				if (authError) {
					setError(authError.message);
					return;
				}

				// If email confirmation is required, show a success message
				if (data.user && !data.session) {
					setSuccess(true);
					return;
				}

				// If auto-confirmed, redirect to onboarding
				if (data.session) {
					navigate({ to: "/onboarding", replace: true });
				}
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: "Sign up failed. Please try again.",
				);
			} finally {
				setLoading(false);
			}
		},
		[email, password, firstName, navigate],
	);

	const getPasswordStrength = (pw: string) => {
		let score = 0;
		if (pw.length >= 8) score++;
		if (pw.length >= 12) score++;
		if (/[A-Z]/.test(pw)) score++;
		if (/[a-z]/.test(pw)) score++;
		if (/[0-9]/.test(pw)) score++;
		if (/[^A-Za-z0-9]/.test(pw)) score++;
		return score;
	};

	const passwordStrength = getPasswordStrength(password);
	const strengthLabels = [
		"",
		"Very Weak",
		"Weak",
		"Fair",
		"Good",
		"Strong",
		"Very Strong",
	];
	const strengthColors = [
		"",
		"var(--accent-secondary)",
		"var(--accent-fire)",
		"var(--accent-primary)",
		"var(--accent-cyan)",
		"var(--accent-success)",
		"var(--accent-success)",
	];

	const onFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
		e.currentTarget.style.borderColor = "rgba(234,179,8,0.5)";
		e.currentTarget.style.boxShadow = "0 0 20px rgba(234,179,8,0.1)";
	}, []);
	const onBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
		e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
		e.currentTarget.style.boxShadow = "none";
	}, []);

	const GLASS_INPUT_STYLE: React.CSSProperties = {
		background: "rgba(255,255,255,0.05)",
		border: "1px solid rgba(255,255,255,0.1)",
	};

	const GOLD_BUTTON_STYLE: React.CSSProperties = {
		background: "linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
		color: "#000",
		boxShadow: "0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.15)",
	};

	const GLASS_CARD_STYLE: React.CSSProperties = {
		background: "rgba(255,255,255,0.04)",
		border: "1px solid rgba(255,255,255,0.08)",
		backdropFilter: "blur(32px)",
		boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)",
	};

	if (success) {
		return (
			<div
				className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
				style={{
					background:
						"linear-gradient(160deg, #0a0014 0%, #110022 25%, #000000 50%, #0a0a0a 70%, #110808 100%)",
				}}
			>
				<div className="w-full max-w-md relative z-10 text-center space-y-6">
					<div
						className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
						style={{
							background:
								"linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))",
							border: "1px solid rgba(34,197,94,0.25)",
							boxShadow: "0 0 30px rgba(34,197,94,0.1)",
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-emerald-400"
						>
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
							<polyline points="22 4 12 14.01 9 11.01" />
						</svg>
					</div>
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-white">
							Check your email
						</h1>
						<p className="mt-2 text-white/50">
							We sent a confirmation link to{" "}
							<strong className="text-amber-400">{email}</strong>. Click the
							link to activate your account.
						</p>
					</div>
					<a
						href="/auth/sign-in"
						className="inline-block text-sm text-amber-400 hover:text-amber-300 transition"
					>
						Back to sign in
					</a>
				</div>
			</div>
		);
	}

	return (
		<div
			className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
			style={{
				background:
					"linear-gradient(160deg, #0a0014 0%, #110022 25%, #000000 50%, #0a0a0a 70%, #110808 100%)",
			}}
		>
			{/* Gradient overlays */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse 80% 50% at 50% 0%, rgba(234,179,8,0.06) 0%, transparent 60%)",
				}}
			/>
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse 60% 40% at 20% 80%, rgba(168,85,247,0.05) 0%, transparent 60%)",
				}}
			/>

			<div
				className="absolute top-0 left-0 right-0 h-px"
				style={{
					background:
						"linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)",
				}}
			/>

			<div className="w-full max-w-md space-y-6 relative z-10">
				{/* Logo */}
				<div
					className="flex flex-col items-center gap-4"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.1s both" }}
				>
					<div
						className="w-14 h-14 rounded-2xl flex items-center justify-center"
						style={{
							background:
								"linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))",
							border: "1px solid rgba(234,179,8,0.25)",
							boxShadow: "0 0 30px rgba(234,179,8,0.1)",
						}}
					>
						<img src="/logo-square.svg" alt="" className="w-10 h-10" />
					</div>
					<div className="flex items-center justify-center">
						<img
							src="/logo-horizontal.svg"
							alt="FYKING"
							className="h-8 w-auto"
							style={{ filter: "drop-shadow(0 0 20px rgba(234,179,8,0.2))" }}
						/>
					</div>
				</div>

				<div
					className="text-center"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.2s both" }}
				>
					<p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">
						JOIN THE KINGDOM
					</p>
				</div>

				{/* Glass auth card */}
				<div
					className="rounded-2xl p-6 sm:p-7 relative overflow-hidden"
					style={{
						...GLASS_CARD_STYLE,
						animation: "auth-slideUp 0.6s ease-out 0.3s both",
					}}
				>
					{error && (
						<div
							className="mb-4 rounded-lg p-3 text-sm text-red-400"
							style={{
								background: "rgba(239,68,68,0.1)",
								border: "1px solid rgba(239,68,68,0.2)",
							}}
						>
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
								Name
							</label>
							<div className="relative">
								<User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
								<input
									placeholder="Your name"
									value={firstName}
									onChange={(e) => setFirstName(e.target.value)}
									className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
									style={GLASS_INPUT_STYLE}
									onFocus={onFocus}
									onBlur={onBlur}
									required
								/>
							</div>
						</div>
						<div className="space-y-2">
							<label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
								Email
							</label>
							<div className="relative">
								<Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
								<input
									type="email"
									placeholder="king@fyk.app"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="w-full h-12 pl-11 pr-4 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
									style={GLASS_INPUT_STYLE}
									onFocus={onFocus}
									onBlur={onBlur}
									required
								/>
							</div>
						</div>
						<div className="space-y-2">
							<label className="text-xs font-medium text-white/60 uppercase tracking-wider font-mono">
								Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
								<input
									type={showPassword ? "text" : "password"}
									placeholder="Min 8 chars, upper + lower + number"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full h-12 pl-11 pr-11 rounded-xl text-white placeholder:text-white/25 transition-all duration-300 text-sm"
									style={GLASS_INPUT_STYLE}
									onFocus={onFocus}
									onBlur={onBlur}
									required
									minLength={8}
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3.5 top-1/2 -translate-y-1/2"
								>
									{showPassword ? (
										<EyeOff className="h-4 w-4 text-white/30 hover:text-white/50 transition" />
									) : (
										<Eye className="h-4 w-4 text-white/30 hover:text-white/50 transition" />
									)}
								</button>
							</div>
							{password.length > 0 && (
								<div className="space-y-1">
									<div className="flex gap-1">
										{[1, 2, 3, 4, 5, 6].map((i) => (
											<div
												key={i}
												className="h-1 flex-1 rounded-full transition-colors duration-300"
												style={{
													backgroundColor:
														i <= passwordStrength
															? strengthColors[passwordStrength]
															: "rgba(255,255,255,0.08)",
												}}
											/>
										))}
									</div>
									<p
										className="text-[11px]"
										style={{ color: strengthColors[passwordStrength] }}
									>
										{strengthLabels[passwordStrength]}
									</p>
								</div>
							)}
						</div>
						<button
							type="submit"
							className="w-full h-12 rounded-xl font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
							style={GOLD_BUTTON_STYLE}
							disabled={loading}
						>
							{loading ? (
								<span className="flex items-center gap-2">
									<span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
									Creating account...
								</span>
							) : (
								<>
									CREATE ACCOUNT
									<ArrowRight className="w-4 h-4" />
								</>
							)}
						</button>
					</form>
				</div>

				{/* Mode switcher */}
				<div
					className="text-center"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.5s both" }}
				>
					<p className="text-xs text-white/40">
						Already have an account?{" "}
						<a
							href="/auth/sign-in"
							className="text-amber-400 hover:text-amber-300 transition font-medium"
						>
							Sign in
						</a>
					</p>
				</div>

				{/* Trust strip */}
				<div
					className="flex items-center justify-center gap-5"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.6s both" }}
				>
					{[
						{ icon: LockKeyhole, text: "E2E ENCRYPTED" },
						{ icon: Shield, text: "GDPR" },
					].map((t) => (
						<div key={t.text} className="flex items-center gap-1.5">
							<t.icon className="w-3 h-3 text-amber-400/25" />
							<span
								className="text-white/25 font-mono uppercase tracking-wider"
								style={{ fontSize: "0.55rem" }}
							>
								{t.text}
							</span>
						</div>
					))}
				</div>
			</div>

			<style>{`
				@keyframes auth-slideUp {
					from { opacity: 0; transform: translateY(20px); }
					to { opacity: 1; transform: translateY(0); }
				}
			`}</style>
		</div>
	);
}
