import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { requireSupabase } from "#/integrations/supabase/client";
import {
	Eye,
	EyeOff,
	Mail,
	Lock,
	User,
	ArrowRight,
	ArrowLeft,
	KeyRound,
	Sparkles,
	Crown,
	Shield,
	LockKeyhole,
} from "lucide-react";

type AuthMode = "login" | "signup" | "forgot" | "reset" | "magic-link";

function extractError(err: unknown, fallback = "Login failed"): string {
	if (typeof err === "string") return err;
	if (err instanceof Error) return err.message;
	return fallback;
}

export function FYKAuthPage({
	onGoToChat,
	onLoginSuccess,
	initialMode = "login",
}: {
	onGoToChat?: () => void;
	onLoginSuccess?: () => void;
	initialMode?: AuthMode;
}) {
	const [mode, setMode] = useState<AuthMode>(initialMode);
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [handle, setHandle] = useState("");
	const [newPassword, setNewPassword] = useState("");

	const navigate = useNavigate();

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

	const handleLogin = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setLoading(true);
			setError(null);
			try {
				if (!email || !password) {
					setError("Email and password are required");
					return;
				}
				const { data, error: authError } =
					await requireSupabase().auth.signInWithPassword({
						email,
						password,
					});
				if (authError) {
					setError(authError.message);
					return;
				}
				if (data.session) {
					onLoginSuccess?.() || navigate({ to: "/grid", replace: true });
				}
			} catch (err) {
				setError(extractError(err));
			} finally {
				setLoading(false);
			}
		},
		[email, password, navigate, onLoginSuccess],
	);

	const handleSignup = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setLoading(true);
			setError(null);
			try {
				if (!email || !password || !name) {
					setError("Name, email, and password are required");
					return;
				}
				const { data, error: authError } = await requireSupabase().auth.signUp({
					email,
					password,
					options: {
						data: {
							first_name: name || undefined,
							handle: handle || undefined,
						},
					},
				});
				if (authError) {
					setError(authError.message);
					return;
				}
				if (data.session) {
					navigate({ to: "/onboarding", replace: true });
				} else if (data.user) {
					setMode("login");
					setError(null);
				}
			} catch (err) {
				setError(extractError(err));
			} finally {
				setLoading(false);
			}
		},
		[email, password, name, handle, navigate],
	);

	const handleForgotPassword = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setLoading(true);
			setError(null);
			try {
				const { error: authError } = await requireSupabase().auth.resetPasswordForEmail(
					email,
					{
						redirectTo: `${window.location.origin}/auth/callback`,
					},
				);
				if (authError) {
					setError(authError.message);
					return;
				}
				setMode("login");
				setError(null);
			} catch (err) {
				setError(extractError(err));
			} finally {
				setLoading(false);
			}
		},
		[email],
	);

	const handleResetPassword = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setLoading(true);
			setError(null);
			try {
				const { error: authError } = await requireSupabase().auth.updateUser({
					password: newPassword,
				});
				if (authError) {
					setError(authError.message);
					return;
				}
				setMode("login");
				setPassword("");
			} catch (err) {
				setError(extractError(err));
			} finally {
				setLoading(false);
			}
		},
		[newPassword],
	);

	const handleMagicLink = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setLoading(true);
			setError(null);
			try {
				const { error: authError } = await requireSupabase().auth.signInWithOtp({
					email,
					options: {
						emailRedirectTo: `${window.location.origin}/auth/callback`,
					},
				});
				if (authError) {
					setError(authError.message);
					return;
				}
				setMode("login");
			} catch (err) {
				setError(extractError(err));
			} finally {
				setLoading(false);
			}
		},
		[email],
	);

	const modeLabels: Record<AuthMode, string> = {
		login: "WELCOME BACK",
		signup: "JOIN THE KINGDOM",
		forgot: "RESET PASSWORD",
		reset: "NEW PASSWORD",
		"magic-link": "MAGIC LINK",
	};

	const inputStyle = {
		background: "rgba(255,255,255,0.05)",
		border: "1px solid rgba(255,255,255,0.1)",
	};

	return (
		<div
			className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6"
			style={{
				background:
					"linear-gradient(160deg, #0a0014 0%, #110022 25%, #000000 50%, #0a0a0a 70%, #110808 100%)",
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
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse 60% 40% at 20% 80%, rgba(168,85,247,0.05) 0%, transparent 60%)",
				}}
			/>

			{/* Floating orbs */}
			<div
				className="pointer-events-none absolute right-[-5%] top-[5%] h-[250px] w-[250px] rounded-full"
				style={{
					background:
						"radial-gradient(circle, rgba(234,179,8,0.12) 0%, transparent 70%)",
					filter: "blur(60px)",
					animation: "auth-floatOrb1 14s ease-in-out infinite",
				}}
			/>
			<div
				className="pointer-events-none absolute bottom-[10%] left-[-3%] h-[200px] w-[200px] rounded-full"
				style={{
					background:
						"radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
					filter: "blur(60px)",
					animation: "auth-floatOrb2 18s ease-in-out infinite",
				}}
			/>

			{/* Top gold line */}
			<div
				className="absolute left-0 right-0 top-0 h-px"
				style={{
					background:
						"linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)",
				}}
			/>

			<div className="relative z-10 w-full max-w-md space-y-6">
				{/* Crown + Logo */}
				<div
					className="flex flex-col items-center gap-4"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.1s both" }}
				>
					<div
						className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
						style={{
							background:
								"linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))",
							border: "1px solid rgba(234,179,8,0.25)",
							boxShadow: "0 0 30px rgba(234,179,8,0.1)",
							animation: "auth-crownFloat 4s ease-in-out infinite",
						}}
					>
						<Crown className="h-7 w-7 text-amber-400" strokeWidth={1.2} />
					</div>
					<div>
						<h1 className="font-heading text-3xl font-bold tracking-tight text-white">
							FYK
						</h1>
						<p className="text-center text-sm text-white/50">Find Your King</p>
					</div>
				</div>

				{/* Mode label */}
				<div
					className="text-center"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.2s both" }}
				>
					<p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">
						{modeLabels[mode]}
					</p>
				</div>

				{/* Auth Card */}
				<div
					className="relative overflow-hidden rounded-2xl p-6 sm:p-7"
					style={{
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(255,255,255,0.08)",
						backdropFilter: "blur(32px)",
						boxShadow:
							"0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)",
						animation: "auth-slideUp 0.6s ease-out 0.3s both",
					}}
				>
					{error && (
						<div
							className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400"
							role="alert"
						>
							{error}
						</div>
					)}

					{/* Login Form */}
					{mode === "login" && (
						<form onSubmit={handleLogin} className="space-y-4">
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									Email
								</label>
								<div className="relative">
									<Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										type="email"
										placeholder="king@fyk.app"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-4 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										onFocus={(e) => {
											e.currentTarget.style.borderColor = "rgba(234,179,8,0.5)";
											e.currentTarget.style.boxShadow =
												"0 0 20px rgba(234,179,8,0.1)";
										}}
										onBlur={(e) => {
											e.currentTarget.style.borderColor =
												"rgba(255,255,255,0.1)";
											e.currentTarget.style.boxShadow = "none";
										}}
										required
									/>
								</div>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
										Password
									</label>
									<button
										type="button"
										onClick={() => setMode("forgot")}
										className="text-[11px] font-medium text-amber-400/70 transition hover:text-amber-400"
									>
										Forgot?
									</button>
								</div>
								<div className="relative">
									<Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										type={showPassword ? "text" : "password"}
										placeholder="Enter your password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-11 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										onFocus={(e) => {
											e.currentTarget.style.borderColor = "rgba(234,179,8,0.5)";
											e.currentTarget.style.boxShadow =
												"0 0 20px rgba(234,179,8,0.1)";
										}}
										onBlur={(e) => {
											e.currentTarget.style.borderColor =
												"rgba(255,255,255,0.1)";
											e.currentTarget.style.boxShadow = "none";
										}}
										required
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-3.5 top-1/2 -translate-y-1/2"
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4 text-white/30 transition hover:text-white/50" />
										) : (
											<Eye className="h-4 w-4 text-white/30 transition hover:text-white/50" />
										)}
									</button>
								</div>
							</div>
							<button
								type="submit"
								className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
								style={{
									background:
										"linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
									color: "#000",
									boxShadow:
										"0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.15)",
								}}
								disabled={loading}
							>
								{loading ? (
									<span className="flex items-center gap-2">
										<span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
										Signing in...
									</span>
								) : (
									<>
										SIGN IN
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</button>
							<button
								type="button"
								onClick={() => setMode("magic-link")}
								className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-amber-400/60 transition hover:text-amber-400"
							>
								<Sparkles className="h-3 w-3" /> Sign in with magic link
							</button>
						</form>
					)}

					{/* Signup Form */}
					{mode === "signup" && (
						<form onSubmit={handleSignup} className="space-y-4">
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									Name
								</label>
								<div className="relative">
									<User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										placeholder="Your name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-4 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										required
									/>
								</div>
							</div>
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									Email
								</label>
								<div className="relative">
									<Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										type="email"
										placeholder="king@fyk.app"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-4 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										required
									/>
								</div>
							</div>
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									Handle (optional)
								</label>
								<div className="relative">
									<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-white/30">
										@
									</span>
									<input
										placeholder="yourhandle"
										value={handle}
										onChange={(e) =>
											setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
										}
										className="h-12 w-full rounded-xl py-2 pr-4 pl-9 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										maxLength={20}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									Password
								</label>
								<div className="relative">
									<Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										type={showPassword ? "text" : "password"}
										placeholder="Min 8 chars, upper + lower + number"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-11 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										required
										minLength={8}
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-3.5 top-1/2 -translate-y-1/2"
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4 text-white/30 transition hover:text-white/50" />
										) : (
											<Eye className="h-4 w-4 text-white/30 transition hover:text-white/50" />
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
								className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
								style={{
									background:
										"linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
									color: "#000",
									boxShadow:
										"0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.15)",
								}}
								disabled={loading}
							>
								{loading ? (
									<span className="flex items-center gap-2">
										<span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
										Creating account...
									</span>
								) : (
									<>
										CREATE ACCOUNT
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</button>
						</form>
					)}

					{/* Forgot Password */}
					{mode === "forgot" && (
						<form onSubmit={handleForgotPassword} className="space-y-4">
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									Email address
								</label>
								<div className="relative">
									<Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										type="email"
										placeholder="king@fyk.app"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-4 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										required
									/>
								</div>
							</div>
							<button
								type="submit"
								className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
								style={{
									background:
										"linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
									color: "#000",
									boxShadow:
										"0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.15)",
								}}
								disabled={loading}
							>
								{loading ? (
									<span className="flex items-center gap-2">
										<span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
										Sending...
									</span>
								) : (
									<>
										SEND RESET LINK
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</button>
							<button
								type="button"
								onClick={() => setMode("login")}
								className="flex w-full items-center justify-center gap-1 text-xs text-white/40 transition hover:text-white/70"
							>
								<ArrowLeft className="h-3 w-3" /> Back to sign in
							</button>
						</form>
					)}

					{/* Reset Password */}
					{mode === "reset" && (
						<form onSubmit={handleResetPassword} className="space-y-4">
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									New Password
								</label>
								<div className="relative">
									<KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										type={showPassword ? "text" : "password"}
										placeholder="Min 8 chars"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-4 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										required
										minLength={8}
									/>
								</div>
							</div>
							<button
								type="submit"
								className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
								style={{
									background:
										"linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
									color: "#000",
									boxShadow:
										"0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.15)",
								}}
								disabled={loading}
							>
								{loading ? (
									<span className="flex items-center gap-2">
										<span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
										Resetting...
									</span>
								) : (
									<>
										RESET PASSWORD
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</button>
						</form>
					)}

					{/* Magic Link */}
					{mode === "magic-link" && (
						<form onSubmit={handleMagicLink} className="space-y-4">
							<div className="space-y-2">
								<label className="font-mono text-xs font-medium uppercase tracking-wider text-white/60">
									Email address
								</label>
								<div className="relative">
									<Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
									<input
										type="email"
										placeholder="king@fyk.app"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="h-12 w-full rounded-xl py-2 pr-4 pl-11 text-sm text-white placeholder:text-white/25 transition-all duration-300"
										style={inputStyle}
										required
									/>
								</div>
								<p className="text-[11px] text-white/30">
									We'll send you a secure link — no password needed.
								</p>
							</div>
							<button
								type="submit"
								className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
								style={{
									background:
										"linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
									color: "#000",
									boxShadow:
										"0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(234,179,8,0.15)",
								}}
								disabled={loading}
							>
								{loading ? (
									<span className="flex items-center gap-2">
										<span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
										Sending magic link...
									</span>
								) : (
									<>
										SEND MAGIC LINK
										<Sparkles className="h-4 w-4" />
									</>
								)}
							</button>
							<button
								type="button"
								onClick={() => setMode("login")}
								className="flex w-full items-center justify-center gap-1 text-xs text-white/40 transition hover:text-white/70"
							>
								<ArrowLeft className="h-3 w-3" /> Back to sign in
							</button>
						</form>
					)}

					{/* Divider + Social (login only) */}
					{mode === "login" && (
						<div className="mt-6 space-y-3">
							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<div
										className="w-full"
										style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
									/>
								</div>
								<div className="relative flex justify-center text-[10px] uppercase">
									<span
										className="px-3 font-mono tracking-wider text-white/30"
										style={{ background: "rgba(15,15,25,1)" }}
									>
										Or continue with
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={async () => {
									const { error: authError } =
										await requireSupabase().auth.signInWithOAuth({
											provider: "google",
											options: {
												redirectTo: `${window.location.origin}/auth/callback`,
											},
										});
									if (authError) {
										setError(authError.message);
									}
								}}
								className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl text-sm text-white/70 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
								style={inputStyle}
							>
								<svg className="h-4 w-4" viewBox="0 0 24 24">
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
								Continue with Google
							</button>
						</div>
					)}
				</div>

				{/* Mode switcher */}
				<div
					className="text-center"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.5s both" }}
				>
					{mode === "login" && (
						<p className="text-xs text-white/40">
							Don't have an account?{" "}
							<button
								type="button"
								onClick={() => setMode("signup")}
								className="font-medium text-amber-400 transition hover:text-amber-300"
							>
								Sign up
							</button>
						</p>
					)}
					{mode === "signup" && (
						<p className="text-xs text-white/40">
							Already have an account?{" "}
							<button
								type="button"
								onClick={() => setMode("login")}
								className="font-medium text-amber-400 transition hover:text-amber-300"
							>
								Sign in
							</button>
						</p>
					)}
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
							<t.icon className="h-3 w-3 text-amber-400/25" />
							<span className="font-mono text-[0.55rem] uppercase tracking-wider text-white/25">
								{t.text}
							</span>
						</div>
					))}
				</div>

				{/* Skip to chat */}
				<div
					className="flex justify-center"
					style={{ animation: "auth-slideUp 0.6s ease-out 0.7s both" }}
				>
					<button
						onClick={onGoToChat || (() => navigate({ to: "/", replace: true }))}
						className="text-[11px] font-medium text-white/20 transition hover:text-amber-400/60"
					>
						Skip — browse without signing up &rarr;
					</button>
				</div>
			</div>

			{/* Auth-specific keyframes */}
			<style>{`
				@keyframes auth-slideUp {
					from { opacity: 0; transform: translateY(20px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes auth-crownFloat {
					0%, 100% { transform: translateY(0); }
					50% { transform: translateY(-4px); }
				}
				@keyframes auth-floatOrb1 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(20px, -15px) scale(1.05); }
					66% { transform: translate(-10px, 10px) scale(0.95); }
				}
				@keyframes auth-floatOrb2 {
					0%, 100% { transform: translate(0, 0) scale(1); }
					33% { transform: translate(-15px, 20px) scale(1.08); }
					66% { transform: translate(10px, -10px) scale(0.92); }
				}
			`}</style>
		</div>
	);
}
