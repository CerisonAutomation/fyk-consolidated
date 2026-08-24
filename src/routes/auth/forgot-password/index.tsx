import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/auth/forgot-password/")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!email.trim()) {
			setError("Email is required");
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			setError("Enter a valid email address");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch("/api/request-password-reset", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email.trim(),
					redirectTo: "/auth/reset-password",
				}),
			});

			if (!response.ok) {
				const data = await response.json().catch(() => null);
				setError(data?.message || "Failed to send reset email.");
				return;
			}

			setSent(true);
		} catch {
			setError("An unexpected error occurred. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="flex min-h-dvh flex-col items-center justify-center px-8">
			<div className="w-full max-w-sm">
				<div className="mb-8 text-center">
					<h1 className="font-heading text-3xl font-semibold tracking-tight">
						FYK
					</h1>
					<p className="mt-1 text-muted-foreground">Reset your password</p>
				</div>

				{sent ? (
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="rounded-full bg-primary/10 p-4">
							<span className="text-2xl">✉️</span>
						</div>
						<div>
							<h2 className="font-medium">Check your email</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								We sent a password reset link to{" "}
								<span className="font-medium">{email}</span>
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								setSent(false);
								setEmail("");
							}}
							className="mt-2 text-sm text-primary hover:underline"
						>
							Try a different email
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<p className="text-sm text-muted-foreground">
							Enter your email address and we'll send you a link to reset your
							password.
						</p>

						{error && (
							<div
								role="alert"
								className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
							>
								{error}
							</div>
						)}

						<div>
							<label htmlFor="email" className="mb-1 block text-sm font-medium">
								Email
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="you@example.com"
								autoComplete="email"
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{loading ? "Sending..." : "Send Reset Link"}
						</button>
					</form>
				)}

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Remember your password?{" "}
					<Link to="/auth/sign-in" className="text-primary hover:underline">
						Sign in
					</Link>
				</p>
			</div>
		</main>
	);
}
