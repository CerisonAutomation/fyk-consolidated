import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ChevronLeft,
	Eye,
	EyeOff,
	Globe,
	Lock,
	MapPin,
	Shield,
} from "lucide-react";
import { useServerSettings } from "#/domains/settings/use-server-settings";
import { requireDocumentSession } from "#/lib/document-auth";
import type { PrivacyField } from "#/lib/settings-map";

export const Route = createFileRoute("/settings/privacy/")({
	// AUDIT §3.3: a private screen must not be rendered for a request that carries no
	// session. `requireDocumentSession` is the isomorphic guard — its client branch is
	// a no-op, because a browser has no credential to inspect and `/api/*` verifies
	// every request and 401s without one; its server branch is the redirect.
	beforeLoad: async () => {
		await requireDocumentSession();
	},
	component: PrivacySettingsPage,
	// No `loader` any more, and that is the fix: this screen used to hydrate from
	// `localStorage`, which is what made every switch below a per-browser note to
	// self. The values now come from `GET /api/settings` — the endpoint whose
	// columns `toProfileCard()` and `0026`'s delivery policy actually read — through
	// `useServerSettings`, and every tap is a `PUT` there.
});

function PrivacySettingsPage() {
	const { value, toggle, pending, error, saved, isLoading } =
		useServerSettings();
	// The rows come from this list rather than being written inline, so a switch
	// cannot reach the screen without a column to write: `PrivacyField` is derived
	// from `PRIVACY_FIELDS` in the mapping table, and `settings-map.test.ts` fails
	// if the two stop agreeing.
	const rows: Array<{
		field: PrivacyField;
		icon: typeof Eye;
		label: string;
		description: string;
	}> = [
		{
			icon: MapPin,
			label: "Show Distance",
			description: "Display your approximate distance to others",
			field: "showDistance",
		},
		{
			icon: Eye,
			label: "Show Online Status",
			description: "Let others see when you're online",
			field: "showOnlineStatus",
		},
		{
			icon: Globe,
			label: "Show Last Online",
			description: "Display when you were last active",
			field: "showLastOnline",
		},
		{
			icon: EyeOff,
			label: "Incognito Mode",
			description: "Browse without appearing in others' grids",
			field: "incognitoMode",
		},
		{
			icon: Lock,
			label: "Hide from Search",
			description: "Prevent your profile from appearing in search results",
			field: "hideFromSearch",
		},
	];

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					<div className="mb-6 flex items-center gap-3">
						<Link
							to="/settings/account"
							className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10"
						>
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<h1 className="font-display text-xl font-semibold tracking-wide text-white">
							Privacy
						</h1>
					</div>

					{saved && (
						<div className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-center text-xs text-green-400">
							Saved ✓
						</div>
					)}
					{error && (
						<div className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-center text-xs text-red-400">
							{error}
						</div>
					)}
					{isLoading && (
						<p className="mb-4 text-center text-xs text-white/30">
							Loading your privacy settings…
						</p>
					)}

					<p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
						PROFILE VISIBILITY
					</p>

					<div className="space-y-3">
						{rows.map((item) => {
							const Icon = item.icon;
							const field = item.field;
							const enabled = value(field);
							return (
								<div
									key={item.field}
									className="glass-card flex items-center gap-3 px-4 py-3"
								>
									<div
										className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
										style={{
											background:
												"color-mix(in srgb, var(--accent-primary) 12%, transparent)",
										}}
									>
										<Icon className="h-5 w-5 text-amber-400" />
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium text-white/90">
											{item.label}
										</p>
										<p className="mt-0.5 text-xs text-white/40">
											{item.description}
										</p>
									</div>
									<button
										type="button"
										onClick={() => void toggle(field)}
										aria-pressed={enabled}
										aria-busy={pending === field}
										disabled={pending !== null}
										className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
										style={{
											background: enabled
												? "rgba(234,179,8,0.3)"
												: "rgba(255,255,255,0.08)",
										}}
									>
										<div
											className="absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all"
											style={{
												left: enabled ? "22px" : "2px",
												background: enabled
													? "#EAAB08"
													: "rgba(255,255,255,0.3)",
											}}
										/>
									</button>
								</div>
							);
						})}
					</div>

					<p className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
						BLOCKED & RESTRICTED
					</p>
					<div className="space-y-3">
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
								<p className="text-sm font-medium text-white/90">
									Blocked Users
								</p>
								<p className="mt-0.5 text-xs text-white/40">
									Manage who can see you
								</p>
							</div>
							<svg
								aria-hidden="true"
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
				</div>
			</div>
		</main>
	);
}
