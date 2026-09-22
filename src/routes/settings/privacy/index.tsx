import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import {
	ChevronLeft,
	Eye,
	EyeOff,
	Ghost,
	MapPin,
	SearchX,
	ShieldCheck,
	Wifi,
} from "lucide-react";
import { useServerSettings } from "@/domains/settings/use-server-settings";
import { requireDocumentSession } from "@/lib/document-auth";
import { PRIVACY_FIELDS, type PrivacyField } from "@/lib/settings-map";

/**
 * `/settings/privacy` — the switches that decide what *other people* see.
 *
 * Every row on this screen is a column on `users`, read and written through
 * `GET/PUT /api/settings` by {@link useServerSettings}. That is the whole point of
 * the screen: "hide my online status" is a promise about what the server tells
 * everyone else, so a value that lives in `localStorage` cannot keep it — the old
 * version of this page rendered "Saved ✓" while presence kept broadcasting
 * (`src/lib/settings-map.test.ts` fails on that shape on purpose).
 *
 * The rows are declared as data, not as five copies of a toggle, so the list and
 * `PRIVACY_FIELDS` cannot drift: a row whose field is not in that union does not
 * typecheck, and a field with no row is caught by the test that counts them.
 */
export const Route = createFileRoute("/settings/privacy/")({
	// A private screen must not render for a request with no session; the guard's
	// client branch is a no-op and its server branch is the redirect. AUDIT §3.3.
	beforeLoad: async () => {
		await requireDocumentSession();
	},
	component: PrivacySettingsScreen,
});

type Row = {
	field: PrivacyField;
	label: string;
	description: string;
	column: string;
	icon: typeof Eye;
};

/**
 * Label → column is documented per row because the polarity is not uniform:
 * "Show distance" on is `hide_distance = false`, while "Incognito mode" on is
 * `incognito = true`. `patchFor()`/`valueFor()` own that mapping; this table only
 * explains it to the person reading the screen.
 */
const rows: Row[] = [
	{
		field: "showDistance",
		label: "Show my distance",
		description: "Off shows an approximate distance instead of a precise one",
		column: "users.hide_distance",
		icon: MapPin,
	},
	{
		field: "showOnlineStatus",
		label: "Show online status",
		description: "Off removes the green dot from your card for everyone",
		column: "users.hide_online",
		icon: Wifi,
	},
	{
		field: "showLastOnline",
		label: "Show last online",
		description: "Off hides the timestamp under your name in chat",
		column: "users.hide_last_online",
		icon: Eye,
	},
	{
		field: "incognitoMode",
		label: "Incognito browsing",
		description: "Browse without recording a footprint on the profiles you open",
		column: "users.incognito",
		icon: Ghost,
	},
	{
		field: "hideFromSearch",
		label: "Hide from search and discovery",
		description: "Off the grid: you stay reachable by people you already matched",
		column: "users.visible",
		icon: SearchX,
	},
];

function PrivacySettingsScreen() {
	const { value, toggle, pending, error, saved, ready, isLoading } =
		useServerSettings();

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					<div className="mb-6 flex items-center gap-3">
						<Link
							to="/settings"
							aria-label="Back to settings"
							className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10"
						>
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<div>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								Privacy
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								What other people are allowed to see
							</p>
						</div>
					</div>

					{saved && (
						<output className="block mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-center text-xs text-green-400">
							Saved ✓
						</output>
					)}
					{error && (
						<p
							className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-center text-xs text-red-400"
							role="alert"
						>
							{error}
						</p>
					)}

					<p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
						VISIBILITY
					</p>

					<div className="space-y-3">
						{isLoading && !ready
							? rows.map((row) => (
									<div
										key={row.field}
										className="glass-card h-[68px] animate-pulse rounded-2xl bg-white/5"
									/>
								))
							: rows.map((row) => {
									const Icon = row.icon;
									const on = value(row.field);
									const busy = pending === row.field;
									return (
										<div
											key={row.field}
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
													{row.label}
												</p>
												<p className="mt-0.5 text-xs text-white/40">
													{row.description}
												</p>
											</div>
											<button
												type="button"
												role="switch"
												aria-checked={on}
												aria-label={row.label}
												aria-busy={busy}
												disabled={pending !== null || !ready}
												onClick={() => void toggle(row.field)}
												className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
												style={{
													background: on
														? "rgba(234,179,8,0.3)"
														: "rgba(255,255,255,0.08)",
												}}
											>
												<span
													className="absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all"
													style={{
														left: on ? "22px" : "2px",
														background: on
															? "#EAAB08"
															: "rgba(255,255,255,0.3)",
													}}
												/>
											</button>
										</div>
									);
								})}
					</div>

					<div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
						<div className="flex items-start gap-3">
							<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
							<div>
								<p className="text-xs font-medium text-white/80">
									These switches are stored on your account
								</p>
								<p className="mt-1 text-[11px] leading-relaxed text-white/40">
									Each one writes a column the API already enforces — cards,
									presence, footprints and discovery all read the same value,
									on every device. A write that fails rolls the switch back and
									says so above rather than showing a saved state the server
									refused.
								</p>
							</div>
						</div>
					</div>

					<p className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
						RELATED CONTROLS
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						<RelatedLink to="/settings/blocked" label="Blocked users" />
						<RelatedLink to="/settings/hidden" label="Hidden profiles" />
						<RelatedLink to="/settings/data-export" label="Export my data" />
						<RelatedLink to="/settings/deactivate" label="Delete account" />
						<RelatedLink to="/settings/discreet-icon" label="Discreet icon" />
						<RelatedLink to="/settings/pin-lock" label="PIN and biometrics" />
					</div>

					<p className="mt-6 flex items-center gap-2 text-[11px] text-white/30">
						<EyeOff className="h-3.5 w-3.5" />
						{PRIVACY_FIELDS.length} server-owned switches · no browser storage
					</p>
				</div>
			</div>
		</main>
	);
}

function RelatedLink({ to, label }: { to: LinkProps["to"]; label: string }) {
	return (
		<Link
			to={to}
			className="glass-card flex items-center justify-between px-4 py-3 text-xs text-white/70 transition hover:text-white"
		>
			{label}
			<ChevronLeft className="h-4 w-4 rotate-180 text-white/30" />
		</Link>
	);
}
