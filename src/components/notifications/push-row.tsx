"use client";

import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/primitives";
import {
	disablePush,
	enablePush,
	type PushState,
	readPushState,
} from "#/lib/push";

/**
 * The device-level half of the notifications screen: the inbox above lists what the server
 * has for you, this says whether your *phone* will be told about it.
 *
 * It is a state readout rather than a switch, because "notifications: on" would be a lie in
 * four of the eight cases below. Every state here is reachable and every one of them used to
 * be invisible: the previous flow requested browser permission on mount, then hung awaiting a
 * service worker that nothing had registered, and swallowed the rest — so a user who tapped
 * "Allow" saw a prompt, a granted permission, and no notifications, forever, with nothing on
 * screen to explain it. In this sandbox the honest rendering is the `no-vapid-key` line, and
 * that is the correct thing for it to say until `VITE_VAPID_PUBLIC_KEY` exists (see
 * `pnpm push:vapid-keys`).
 */
export function PushRow() {
	const [state, setState] = useState<PushState | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let alive = true;
		readPushState().then((next) => {
			if (alive) setState(next);
		});
		return () => {
			alive = false;
		};
	}, []);

	async function toggle(next: "on" | "off") {
		setBusy(true);
		try {
			setState(
				next === "on"
					? await enablePush()
					: await disablePush({ remote: true }),
			);
		} finally {
			setBusy(false);
		}
	}

	if (!state) {
		return (
			<div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
				<Loader2 className="h-4 w-4 animate-spin text-muted" />
				<p className="text-sm text-muted">Checking this device…</p>
			</div>
		);
	}

	const copy = COPY[state.kind];
	const actionable =
		state.kind === "prompt" ||
		state.kind === "off" ||
		state.kind === "on" ||
		state.kind === "error";

	return (
		<div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
			<div className="flex items-start gap-3">
				{state.kind === "on" ? (
					<BellRing className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
				) : state.kind === "error" ? (
					<BellOff className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
				) : (
					<Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
				)}
				<div>
					<p className="text-sm font-semibold text-white">{copy.title}</p>
					<p className="mt-0.5 text-xs text-muted">{copy.detail(state)}</p>
					{state.kind === "on" && (
						<p className="mt-1 truncate text-[11px] text-muted/70">
							{shortEndpoint(state.endpoint)}
						</p>
					)}
				</div>
			</div>
			{actionable && (
				<Button
					variant={state.kind === "on" ? "ghost" : "secondary"}
					size="sm"
					disabled={busy}
					onClick={() => void toggle(state.kind === "on" ? "off" : "on")}
					aria-label={
						state.kind === "on"
							? "Turn off notifications on this device"
							: "Turn on notifications on this device"
					}
				>
					{busy ? "…" : state.kind === "on" ? "Turn off" : "Turn on"}
				</Button>
			)}
		</div>
	);
}

const COPY: Record<
	PushState["kind"],
	{ title: string; detail: (state: PushState) => string }
> = {
	prompt: {
		title: "Push notifications are off",
		detail: () =>
			"You will still see everything here; turning this on also tells your phone.",
	},
	off: {
		title: "Permission granted, this device is not registered",
		detail: () =>
			"Your browser allows notifications but no endpoint is stored for you yet.",
	},
	on: {
		title: "Push notifications are on for this device",
		detail: () => "Matches, messages, check-ins and MeetNow invites.",
	},
	denied: {
		title: "Notifications are blocked for this site",
		detail: () =>
			"Re-allow them in your browser's site settings — a page cannot undo that choice, so there is no button here.",
	},
	"needs-install": {
		title: "Add FYK to your Home Screen first",
		detail: () =>
			"On iPhone, web notifications are delivered to an installed web app, not to Safari. Share → Add to Home Screen, then come back here.",
	},
	"no-vapid-key": {
		title: "Push is not configured for this deployment",
		detail: () =>
			"This server has no VAPID public key (VITE_VAPID_PUBLIC_KEY), so no subscription could be verified. Everything on this page works without it.",
	},
	"dev-server": {
		title: "Push and offline live in the built app",
		detail: () =>
			"The dev server does not register a service worker on purpose. `pnpm build && pnpm start` serves the installable app.",
	},
	unsupported: {
		title: "This browser cannot receive push",
		detail: (state) =>
			state.kind === "unsupported" ? state.reason : "Unsupported here.",
	},
	error: {
		title: "Something failed",
		detail: (state) =>
			state.kind === "error" ? state.message : "Try again in a moment.",
	},
};

/**
 * Enough of the endpoint to tell two phones apart, and nothing more: the path segment of a
 * push endpoint is a bearer credential — anyone holding it can post to that device — so it is
 * never rendered whole, never logged, and never sent anywhere the API does not already get it.
 */
function shortEndpoint(endpoint: string): string {
	try {
		const url = new URL(endpoint);
		return `${url.host} · ${url.pathname.slice(-8)}`;
	} catch {
		return "this device";
	}
}
