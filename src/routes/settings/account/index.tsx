import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ChevronLeft,
	Shield,
	EyeOff,
	Lock,
	Globe,
	UserX,
	Mail,
	KeyRound,
	Trash2,
} from "lucide-react";
import { useAuthStore } from "#/domains/auth/store";

export const Route = createFileRoute("/settings/account/")({
	component: AccountSettingsPage,
});

function AccountSettingsPage() {
	const { auth } = useAuthStore();
	const email = auth?.user?.email ?? "";

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					{/* Header */}
					<div className="mb-6 flex items-center gap-3">
						<Link
							to="/settings"
							className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10"
						>
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<h1 className="font-display text-xl font-semibold tracking-wide text-white">
							Account
						</h1>
					</div>

					{/* Account Info */}
					<div className="glass-card mb-6 p-4">
						<p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
							ACCOUNT INFO
						</p>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<Mail className="h-4 w-4 text-white/40" />
								<div>
									<p className="text-xs text-white/40">Email</p>
									<p className="text-sm text-white/80">{email || "Not set"}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<KeyRound className="h-4 w-4 text-white/40" />
								<div>
									<p className="text-xs text-white/40">Password</p>
									<p className="text-sm text-white/80">••••••••</p>
								</div>
							</div>
						</div>
					</div>

					<p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
						MANAGE
					</p>

					<div className="space-y-2">
						<Link
							to="/settings/blocked"
							className="glass-card flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.06]"
						>
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
								style={{
									background: "color-mix(in srgb, #ef4444 12%, transparent)",
								}}
							>
								<Shield className="h-5 w-5 text-red-400" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-white/90">Blocked Users</p>
								<p className="mt-0.5 text-xs text-white/40">
									Profiles you've blocked
								</p>
							</div>
							<svg
								className="h-4 w-4 text-white/30"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="m9 18 6-6-6-6" />
							</svg>
						</Link>

						<Link
							to="/settings/hidden"
							className="glass-card flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.06]"
						>
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
								style={{
									background: "color-mix(in srgb, #f59e0b 12%, transparent)",
								}}
							>
								<EyeOff className="h-5 w-5 text-amber-400" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-white/90">Hidden Users</p>
								<p className="mt-0.5 text-xs text-white/40">
									Profiles hidden from your grid
								</p>
							</div>
							<svg
								className="h-4 w-4 text-white/30"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="m9 18 6-6-6-6" />
							</svg>
						</Link>

						<Link
							to="/settings/privacy"
							className="glass-card flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.06]"
						>
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
								style={{
									background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
								}}
							>
								<Lock className="h-5 w-5 text-amber-400" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-white/90">Privacy</p>
								<p className="mt-0.5 text-xs text-white/40">
									Control who can see your profile
								</p>
							</div>
							<svg
								className="h-4 w-4 text-white/30"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="m9 18 6-6-6-6" />
							</svg>
						</Link>
					</div>

					<p className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
						AUTH
					</p>

					<div className="space-y-2">
						<button
							type="button"
							className="glass-card flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
						>
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
								style={{
									background: "color-mix(in srgb, #3b82f6 12%, transparent)",
								}}
							>
								<Globe className="h-5 w-5 text-blue-400" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-white/90">
									Connected Accounts
								</p>
								<p className="mt-0.5 text-xs text-white/40">
									Manage linked social accounts
								</p>
							</div>
							<svg
								className="h-4 w-4 text-white/30"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="m9 18 6-6-6-6" />
							</svg>
						</button>
					</div>

					<p className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-red-400/70">
						DANGER ZONE
					</p>

					<div className="space-y-2">
						<button
							type="button"
							className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-left transition hover:bg-red-500/10"
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
								<UserX className="h-5 w-5 text-red-400" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-red-400">
									Deactivate Account
								</p>
								<p className="mt-0.5 text-xs text-white/30">
									Temporarily disable your account
								</p>
							</div>
						</button>

						<button
							type="button"
							className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-left transition hover:bg-red-500/10"
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
								<Trash2 className="h-5 w-5 text-red-400" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-red-400">
									Delete Account
								</p>
								<p className="mt-0.5 text-xs text-white/30">
									Permanently remove your data
								</p>
							</div>
						</button>
					</div>
				</div>
			</div>
		</main>
	);
}
