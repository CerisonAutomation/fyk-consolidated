import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/auth/sign-up/")({
	component: SignUpPage,
});

interface FormErrors {
	name?: string;
	email?: string;
	password?: string;
}

function validateName(name: string): string | undefined {
	if (!name.trim()) return "Name is required";
	if (name.trim().length < 2) return "Name must be at least 2 characters";
	return undefined;
}

function validateEmail(email: string): string | undefined {
	if (!email.trim()) return "Email is required";
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
	return undefined;
}

function validatePassword(password: string): string | undefined {
	if (!password) return "Password is required";
	if (password.length < 8) return "Password must be at least 8 characters";
	if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
	if (!/[0-9]/.test(password)) return "Password must contain a number";
	return undefined;
}

function SignUpPage() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const errors: FormErrors = {
			name: validateName(name),
			email: validateEmail(email),
			password: validatePassword(password),
		};
		setFieldErrors(errors);

		if (errors.name || errors.email || errors.password) return;

		setLoading(true);
		try {
			const result = await authClient.signUp.email({
				name: name.trim(),
				email: email.trim(),
				password,
			});

			if (result.error) {
				setError(result.error.message || "Sign up failed. Please try again.");
				return;
			}

			navigate({ to: "/onboarding" });
		} catch {
			setError("An unexpected error occurred. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleSignUp = async () => {
		setError(null);
		setLoading(true);
		try {
			await authClient.signIn.social({ provider: "google" });
		} catch {
			setError("Google sign-up failed. Please try again.");
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
					<p className="mt-1 text-muted-foreground">Create your account</p>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					{error && (
						<div
							role="alert"
							className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
						>
							{error}
						</div>
					)}

					<div>
						<label htmlFor="name" className="mb-1 block text-sm font-medium">
							Name
						</label>
						<input
							id="name"
							type="text"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								if (fieldErrors.name) {
									setFieldErrors((prev) => ({ ...prev, name: undefined }));
								}
							}}
							onBlur={() => {
								setFieldErrors((prev) => ({
									...prev,
									name: validateName(name),
								}));
							}}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="Your name"
							autoComplete="name"
							aria-invalid={!!fieldErrors.name}
							aria-describedby={fieldErrors.name ? "name-error" : undefined}
						/>
						{fieldErrors.name && (
							<p id="name-error" className="mt-1 text-xs text-destructive">
								{fieldErrors.name}
							</p>
						)}
					</div>

					<div>
						<label htmlFor="email" className="mb-1 block text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => {
								setEmail(e.target.value);
								if (fieldErrors.email) {
									setFieldErrors((prev) => ({ ...prev, email: undefined }));
								}
							}}
							onBlur={() => {
								setFieldErrors((prev) => ({
									...prev,
									email: validateEmail(email),
								}));
							}}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="you@example.com"
							autoComplete="email"
							aria-invalid={!!fieldErrors.email}
							aria-describedby={fieldErrors.email ? "email-error" : undefined}
						/>
						{fieldErrors.email && (
							<p id="email-error" className="mt-1 text-xs text-destructive">
								{fieldErrors.email}
							</p>
						)}
					</div>

					<div>
						<label htmlFor="password" className="mb-1 block text-sm font-medium">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => {
								setPassword(e.target.value);
								if (fieldErrors.password) {
									setFieldErrors((prev) => ({ ...prev, password: undefined }));
								}
							}}
							onBlur={() => {
								setFieldErrors((prev) => ({
									...prev,
									password: validatePassword(password),
								}));
							}}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="••••••••"
							autoComplete="new-password"
							aria-invalid={!!fieldErrors.password}
							aria-describedby={fieldErrors.password ? "password-error" : undefined}
						/>
						{fieldErrors.password && (
							<p id="password-error" className="mt-1 text-xs text-destructive">
								{fieldErrors.password}
							</p>
						)}
						<p className="mt-1 text-xs text-muted-foreground">
							At least 8 characters with an uppercase letter and a number
						</p>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{loading ? "Creating account..." : "Create Account"}
					</button>
				</form>

				<div className="relative my-6">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-border" />
					</div>
					<div className="relative flex justify-center text-xs">
						<span className="bg-background px-2 text-muted-foreground">
							Or continue with
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={handleGoogleSignUp}
					disabled={loading}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
				>
					<svg className="h-4 w-4" viewBox="0 0 24 24">
						<title>Google</title>
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
					Google
				</button>

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link to="/auth/sign-in" className="text-primary hover:underline">
						Sign in
					</Link>
				</p>
			</div>
		</main>
	);
}
