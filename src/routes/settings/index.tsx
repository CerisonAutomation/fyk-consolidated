import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Accessibility,
	Bell,
	Crown,
	Globe,
	LogOut,
	Moon,
	Settings,
	Shield,
	User,
} from "lucide-react";
import {
	GlassCard,
	GoldDivider,
	SectionHeader,
} from "@/core/ui/fyk-primitives";
import { signOut } from "@/domains/auth/services/sign-out";
import { useAuthStore } from "@/domains/auth/store";
import { demoEnabled, demoMeProfileId } from "@/domains/demo";
import { requireDocumentSession } from "@/lib/document-auth";

export const Route = createFileRoute("/settings/")({
	// AUDIT §3.3: a private screen must not be rendered for a request that carries no
	// session. `requireDocumentSession` is the isomorphic guard — its client branch is
	// a no-op, because a browser has no credential to inspect and `/api/*` verifies
	// every request and 401s without one; its server branch is the redirect.
	beforeLoad: async () => {
		await requireDocumentSession();
	},
	component: SettingsPage,
});

function SettingsPage() {
	const { auth } = useAuthStore();
	const profileId =
		auth?.userId ?? (demoEnabled ? String(demoMeProfileId) : null);

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="max-w-lg mx-auto px-4 py-4 pb-24">
					{/* ── Header ── */}
					<div className="flex items-center gap-3 mb-6">
						<div
							className="w-10 h-10 rounded-xl flex items-center justify-center"
							style={{
								background:
									"color-mix(in srgb, var(--accent-primary) 12%, transparent)",
							}}
						>
							<Settings className="w-5 h-5 text-gold" />
						</div>
						<div>
							<h1 className="text-xl font-display text-foreground tracking-wide">
								Settings
							</h1>
							<p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-wider">
								FYK v1.0
							</p>
						</div>
					</div>

					{/* ── Profile Section ── */}
					{profileId && (
						<GlassCard className="p-4 mb-4">
							<SectionHeader label="Your Profile" />
							<Link
								to="/settings/profile"
								className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-white/[0.03]"
							>
								<div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
									<User className="w-5 h-5 text-gold" />
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-foreground/90 truncate">
										My Profile
									</p>
									<p className="text-xs text-muted-foreground/60">
										Edit details, photos and preferences
									</p>
								</div>
								<svg
									aria-hidden="true"
									className="w-4 h-4 text-muted-foreground/30"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="m9 18 6-6-6-6" />
								</svg>
							</Link>
						</GlassCard>
					)}

					{/* ── Account Section ── */}
					<GlassCard className="p-4 mb-4">
						<SectionHeader label="Account" />
						<div className="space-y-1">
							<SettingsLink
								icon={User}
								label="Account"
								description="Email, password, and security"
								href="/settings/account"
							/>
							<SettingsLink
								icon={Shield}
								label="Privacy"
								description="Who can see your profile"
								href="/settings/privacy"
							/>
							<SettingsLink
								icon={Globe}
								label="Blocked"
								description="Manage blocked profiles"
								href="/settings/blocked"
							/>
							<SettingsLink
								icon={Globe}
								label="Hidden"
								description="Manage hidden profiles"
								href="/settings/hidden"
							/>
						</div>
					</GlassCard>

					{/* ── App Section ── */}
					<GlassCard className="p-4 mb-4">
						<SectionHeader label="App" />
						<div className="space-y-1">
							<SettingsLink
								icon={Bell}
								label="Notifications"
								description="Push and in-app alerts"
								href="/settings/app"
							/>
							<SettingsLink
								icon={Moon}
								label="Appearance"
								description="Theme, dark mode, and display"
								href="/settings/app"
							/>
							<SettingsLink
								icon={Accessibility}
								label="Accessibility"
								description="Large text, reduced motion"
								href="/settings/app"
							/>
						</div>
					</GlassCard>

					{/* ── Premium CTA ── */}
					<GlassCard className="p-4 mb-4">
						<Link
							to="/about"
							className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 hover:bg-gold/[0.05]"
							style={{
								background:
									"linear-gradient(135deg, rgba(234,179,8,0.06), rgba(234,179,8,0.02))",
								border: "1px solid rgba(234,179,8,0.15)",
							}}
						>
							<div
								className="w-10 h-10 rounded-xl flex items-center justify-center"
								style={{
									background:
										"linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.08))",
								}}
							>
								<Crown className="w-5 h-5 text-gold" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-display text-gold tracking-wide">
									Go King
								</p>
								<p className="text-xs text-muted-foreground/60">
									Unlock premium features
								</p>
							</div>
							<svg
								aria-hidden="true"
								className="w-4 h-4 text-gold/40"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m9 18 6-6-6-6" />
							</svg>
						</Link>
					</GlassCard>

					<GoldDivider className="my-4" />

					{/* ── Sign Out ── */}
					<GlassCard className="p-4 mb-4">
						<button
							type="button"
							onClick={() => signOut()}
							className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-200 text-sm font-medium"
						>
							<LogOut className="w-4 h-4" />
							<span>Sign Out</span>
						</button>
					</GlassCard>

					{/* ── Footer ── */}
					<div className="text-center py-4">
						<p className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground/30">
							FYK &middot; Find Your King &middot; v1.0
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}

/* ── Settings Link Row ────────────────────────────────────────────── */

function SettingsLink({
	icon: Icon,
	label,
	description,
	href,
}: {
	icon: React.FC<{ className?: string }>;
	label: string;
	description?: string;
	href: string;
}) {
	return (
		<Link
			to={href}
			className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-white/[0.03] group"
		>
			<div
				className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105"
				style={{
					background:
						"color-mix(in srgb, var(--accent-primary) 8%, transparent)",
				}}
			>
				<Icon className="w-5 h-5 text-gold/70 group-hover:text-gold transition-colors" />
			</div>
			<div className="flex-1 min-w-0">
				<span className="text-sm font-medium text-foreground/80 group-hover:text-foreground/95 transition-colors">
					{label}
				</span>
				{description && (
					<p className="text-[11px] text-muted-foreground/50 mt-0.5">
						{description}
					</p>
				)}
			</div>
			<svg
				aria-hidden="true"
				className="w-4 h-4 text-muted-foreground/25 shrink-0 transition-all duration-200 group-hover:text-gold/40 group-hover:translate-x-0.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="m9 18 6-6-6-6" />
			</svg>
		</Link>
	);
}
