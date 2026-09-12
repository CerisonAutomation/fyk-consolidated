import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
	ChevronLeft,
	Settings,
	Shield,
	Globe,
	Smartphone,
	Ruler,
} from "lucide-react";
import {
	getPreferencesSnapshot,
	setPreferences,
	type Preferences,
} from "#/domains/settings/preferences";
import { requireDocumentSession } from "#/lib/document-auth";

export const Route = createFileRoute("/settings/app/")({
	// AUDIT §3.3: a private screen must not be rendered for a request that carries no
	// session. `requireDocumentSession` is the isomorphic guard — its client branch is
	// a no-op, because a browser has no credential to inspect and `/api/*` verifies
	// every request and 401s without one; its server branch is the redirect.
	beforeLoad: async () => {
		await requireDocumentSession();
	},
	component: AppSettingsPage,
	loader: async () => {
		const { hydratePreferences } = await import(
			"#/domains/settings/preferences"
		);
		hydratePreferences();
	},
});

function AppSettingsPage() {
	const prefs = getPreferencesSnapshot();
	const [local, setLocal] = useState<Preferences>(prefs);
	const [, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const update = useCallback(
		async <K extends keyof Preferences>(field: K, value: Preferences[K]) => {
			setLocal((prev) => ({ ...prev, [field]: value }));
			setSaved(false);
			setSaving(true);
			try {
				await setPreferences({ [field]: value });
				setSaved(true);
				setTimeout(() => setSaved(false), 2000);
			} finally {
				setSaving(false);
			}
		},
		[],
	);

	const Toggle = ({
		field,
		label,
		description,
		icon: Icon,
	}: {
		field: keyof Preferences;
		label: string;
		description: string;
		icon: React.FC<{ className?: string }>;
	}) => {
		const value = local[field] as boolean;
		return (
			<div className="glass-card flex items-center gap-3 px-4 py-3">
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
					<p className="text-sm font-medium text-white/90">{label}</p>
					<p className="mt-0.5 text-xs text-white/40">{description}</p>
				</div>
				<button
					type="button"
					onClick={() => update(field, !value)}
					className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
					style={{
						background: value
							? "rgba(234,179,8,0.3)"
							: "rgba(255,255,255,0.08)",
					}}
				>
					<div
						className="absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all"
						style={{
							left: value ? "22px" : "2px",
							background: value ? "#EAAB08" : "rgba(255,255,255,0.3)",
						}}
					/>
				</button>
			</div>
		);
	};

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
						<div>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								App Settings
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								Customize your app experience
							</p>
						</div>
					</div>

					{/* Save indicator */}
					{saved && (
						<div className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-center text-xs text-green-400">
							Saved ✓
						</div>
					)}

					{/* Toggles */}
					<div className="space-y-3">
						<p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
							APPEARANCE
						</p>
						<Toggle
							field="stayOnline"
							label="Stay Online"
							description="Appear online even when app is in background"
							icon={Globe}
						/>

						<div className="pt-3">
							<p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
								PRIVACY
							</p>
						</div>
						<Toggle
							field="revealMessageRead"
							label="Reveal Message Read"
							description="Show when your messages have been read"
							icon={Shield}
						/>
						<Toggle
							field="revealProfileViews"
							label="Reveal Profile Views"
							description="Show when others view your profile"
							icon={Settings}
						/>

						<div className="pt-3">
							<p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
								,LOCATION
							</p>
						</div>
						<Toggle
							field="autoUpdateLocation"
							label="Auto-Update Location"
							description="Automatically update your location when you move"
							icon={Smartphone}
						/>

						<div className="pt-3">
							<p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
								UNITS
							</p>
						</div>
						<div className="glass-card flex items-center gap-3 px-4 py-3">
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
								style={{
									background:
										"color-mix(in srgb, var(--accent-primary) 12%, transparent)",
								}}
							>
								<Ruler className="h-5 w-5 text-amber-400" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-white/90">Units</p>
								<p className="mt-0.5 text-xs text-white/40">
									Choose between metric and imperial
								</p>
							</div>
							<select
								value={local.units}
								onChange={(e) =>
									update("units", e.target.value as "metric" | "imperial")
								}
								className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
							>
								<option value="metric">Metric</option>
								<option value="imperial">Imperial</option>
							</select>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
