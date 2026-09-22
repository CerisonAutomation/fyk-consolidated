import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, ShieldX, Users } from "lucide-react";
import { Button, Skeleton } from "@/components/ui/primitives";
import { api, ApiError, post } from "@/lib/client";
import { cn } from "@/lib/utils";

/**
 * `/admin` — the operator console: platform counts and the moderation queue.
 *
 * WHY IT EXISTS
 * -------------
 * `#/routes/api/admin/kpis` and `#/routes/api/admin/moderation` were the only two routes
 * in this repository with no caller anywhere in `src/`: a console with no page. Both
 * refuse anybody whose `users.role` is not `admin` with a 403, so this screen's job is to
 * render that refusal honestly rather than to gate the data — the gate belongs to the
 * API, and a client-side check would only be decoration.
 *
 * WHAT IT SHOWS
 * -------------
 * The tiles are the counts the endpoint queries. Three of them used to be constants
 * (`avgTrustScore: 65`, `reports: 0`, `pendingVerifications: 0`) with comments saying a
 * query would be needed; they are computed now, so "0 open reports" is the queue rather
 * than a placeholder that reads as "nothing to do".
 *
 * The queue is `public.reports` with the reporter and the reported account joined in and
 * priority derived from the reason — `underage` and `impersonation` first, because a
 * stored priority is a second opinion that can disagree with the reason it describes.
 * Every decision writes: the report's status moves, a suspension sets
 * `users.is_suspended`, the reporter is notified through the `report` type, and an
 * `audit_events` row records who decided what. The response for a suspension says
 * "indefinite until lifted", because there is no `suspended_until` column and a screen
 * implying a timer would be lying about enforcement.
 */

interface Kpis {
	users: { total: number; online: number; verified: number; suspended: number; banned: number };
	tiers: { free: number; plus: number; gold: number; platinum: number; paid: number };
	engagement: {
		taps: number;
		matches: number;
		conversations: number;
		messages: number;
		blocks: number;
		favorites: number;
		footprints: number;
	};
	system: {
		notifications: number;
		avgTrustScore: number;
		reports: number;
		pendingVerifications: number;
	};
	timestamp: string;
}

interface QueueReport {
	id: string;
	reporterId: string;
	reporter: { handle: string | null; displayName: string | null };
	targetId: string;
	target: { handle: string | null; displayName: string | null; suspended: boolean };
	targetType: string;
	reason: string;
	details: string | null;
	status: string;
	priority: "URGENT" | "HIGH" | "MEDIUM";
	createdAt: string;
}

type Decision = "warn" | "suspend" | "ban" | "dismiss";

const STATUS_FILTERS = ["open", "in_review", "action_taken", "dismissed", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export const Route = createFileRoute("/admin/")({
	component: AdminScreen,
});

function AdminScreen() {
	const qc = useQueryClient();
	const [status, setStatus] = useState<StatusFilter>("open");
	const [note, setNote] = useState<string | null>(null);

	const kpis = useQuery({
		queryKey: ["admin", "kpis"],
		queryFn: () => api<Kpis>("/api/admin/kpis"),
		retry: false,
	});

	const queue = useQuery({
		queryKey: ["admin", "moderation", status],
		queryFn: () =>
			api<{ reports: QueueReport[]; count: number; priorities: Record<string, number> }>(
				`/api/admin/moderation?status=${status}`,
			),
		retry: false,
	});

	const decide = useMutation({
		mutationFn: (input: { reportId: string; action: Decision; durationDays?: number }) =>
			post<{ ok: boolean; suspension?: string | null }>("/api/admin/moderation", input),
		onSuccess: (result) => {
			setNote(result.suspension ?? "Decision recorded.");
			qc.invalidateQueries({ queryKey: ["admin"] });
		},
		onError: (error) =>
			setNote(
				error instanceof ApiError || error instanceof Error
					? error.message
					: "That did not go through.",
			),
	});

	if (kpis.error instanceof ApiError && kpis.error.status === 403) {
		return (
			<div className="mx-auto max-w-md p-4 pb-24">
				<div className="rounded-[20px] border border-black/[0.06] bg-white p-6 text-center shadow-sm">
					<ShieldX className="mx-auto h-8 w-8 text-zinc-400" />
					<h1 className="font-display mt-3 text-[20px] font-bold text-black">
						Admins only
					</h1>
					<p className="mt-1 text-[13px] text-zinc-500">
						The counts and the queue are refused to anybody whose role is not{" "}
						<code>admin</code>. That check is in the API; this screen cannot grant
						itself access, and hiding the page would only hide the refusal.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-3xl p-4 pb-24">
			<h1 className="font-display text-[24px] font-bold tracking-tight text-black">
				Admin
			</h1>
			<p className="mt-1 text-[14px] text-zinc-500">
				{kpis.data
					? `Counted at ${new Date(kpis.data.timestamp).toLocaleTimeString()}`
					: "Loading platform counts…"}
			</p>

			{note && (
				<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
					{note}
				</output>
			)}

			<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				{kpis.isLoading ? (
					[0, 1, 2, 3].map((tile) => (
						<Skeleton key={`kpi-skeleton-${tile}`} className="h-20 rounded-[16px]" />
					))
				) : kpis.data ? (
					<>
						<Tile
							icon={<Users className="h-4 w-4" />}
							label="Accounts"
							value={kpis.data.users.total}
							detail={`${kpis.data.users.online} online`}
						/>
						<Tile
							icon={<Activity className="h-4 w-4" />}
							label="Paid tiers"
							value={kpis.data.tiers.paid}
							detail={`${kpis.data.tiers.gold} gold · ${kpis.data.tiers.platinum} platinum`}
						/>
						<Tile
							icon={<AlertTriangle className="h-4 w-4" />}
							label="Open reports"
							value={kpis.data.system.reports}
							detail={`${kpis.data.users.suspended} suspended`}
						/>
						<Tile
							icon={<Activity className="h-4 w-4" />}
							label="Messages"
							value={kpis.data.engagement.messages}
							detail={`${kpis.data.engagement.matches} matches`}
						/>
					</>
				) : null}
			</div>

			{kpis.data && (
				<dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-[16px] border border-black/[0.06] bg-white p-4 text-[12px] sm:grid-cols-3">
					{kpiRows(kpis.data).map((row) => (
						<div key={row.label} className="flex justify-between gap-2">
							<dt className="text-zinc-500">{row.label}</dt>
							<dd className="font-medium tabular-nums text-black">{row.value}</dd>
						</div>
					))}
				</dl>
			)}

			<div className="mt-8 flex flex-wrap items-center gap-2">
				<h2 className="font-display text-[18px] font-bold text-black">
					Moderation queue
				</h2>
				{STATUS_FILTERS.map((name) => (
					<button
						key={name}
						type="button"
						onClick={() => setStatus(name)}
						className={cn(
							"rounded-full border px-3 py-1.5 text-[12px]",
							status === name
								? "border-black bg-black text-white"
								: "border-zinc-200 bg-white text-zinc-600",
						)}
					>
						{name.replace("_", " ")}
					</button>
				))}
			</div>

			{queue.isLoading ? (
				<div className="mt-4 space-y-3">
					{[0, 1].map((row) => (
						<Skeleton key={`queue-skeleton-${row}`} className="h-28 rounded-[16px]" />
					))}
				</div>
			) : (queue.data?.reports.length ?? 0) === 0 ? (
				<p className="mt-4 rounded-[16px] border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center text-[13px] text-zinc-500">
					Nothing with status “{status}”.
				</p>
			) : (
				<div className="mt-4 space-y-3">
					{queue.data?.reports.map((report) => (
						<div
							key={report.id}
							className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm"
						>
							<div className="flex flex-wrap items-center gap-2">
								<span
									className={cn(
										"rounded-full px-2 py-0.5 text-[10px] font-medium",
										report.priority === "URGENT"
											? "bg-red-100 text-red-700"
											: report.priority === "HIGH"
												? "bg-amber-100 text-amber-800"
												: "bg-zinc-100 text-zinc-600",
									)}
								>
									{report.priority}
								</span>
								<span className="text-[13px] font-medium text-black">
									{report.reason}
								</span>
								<span className="text-[11px] text-zinc-400">
									{report.targetType} ·{" "}
									{new Date(report.createdAt).toLocaleString()}
								</span>
							</div>

							<p className="mt-2 text-[12px] text-zinc-600">
								Reported:{" "}
								<strong className="font-medium text-black">
									{report.target.displayName ??
										report.target.handle ??
										report.targetId.slice(0, 8)}
								</strong>
								{report.target.suspended ? " (suspended)" : ""} · by{" "}
								{report.reporter.displayName ??
									report.reporter.handle ??
									report.reporterId.slice(0, 8)}
							</p>

							{report.details && (
								<p className="mt-2 rounded-[10px] bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700">
									{report.details}
								</p>
							)}

							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									type="button"
									onClick={() => decide.mutate({ reportId: report.id, action: "warn" })}
									disabled={decide.isPending}
									className="rounded-full border border-zinc-200 px-3 py-1.5 text-[12px] text-zinc-700 disabled:opacity-60"
								>
									Warn
								</Button>
								<Button
									type="button"
									onClick={() =>
										decide.mutate({
											reportId: report.id,
											action: "suspend",
											durationDays: 7,
										})
									}
									disabled={decide.isPending}
									className="rounded-full border border-zinc-200 px-3 py-1.5 text-[12px] text-zinc-700 disabled:opacity-60"
								>
									Suspend
								</Button>
								<Button
									type="button"
									onClick={() => decide.mutate({ reportId: report.id, action: "ban" })}
									disabled={decide.isPending}
									className="rounded-full bg-black px-3 py-1.5 text-[12px] text-white disabled:opacity-60"
								>
									Ban
								</Button>
								<Button
									type="button"
									onClick={() =>
										decide.mutate({ reportId: report.id, action: "dismiss" })
									}
									disabled={decide.isPending}
									className="rounded-full border border-zinc-200 px-3 py-1.5 text-[12px] text-zinc-700 disabled:opacity-60"
								>
									No action
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			<p className="mt-8 text-[11px] text-zinc-500">
				Reads <code>GET /api/admin/kpis</code> and{" "}
				<code>GET /api/admin/moderation?status=</code>. Suspend records the requested
				duration in the audit row and sets <code>users.is_suspended</code>: there is no{" "}
				<code>suspended_until</code> column, so a suspension lasts until an operator
				lifts it.
			</p>
		</div>
	);
}

function Tile({
	icon,
	label,
	value,
	detail,
}: {
	icon: React.ReactNode;
	label: string;
	value: number;
	detail: string;
}) {
	return (
		<div className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm">
			<p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
				{icon}
				{label}
			</p>
			<p className="font-display mt-1 text-[22px] font-bold tabular-nums text-black">
				{value}
			</p>
			<p className="mt-0.5 text-[11px] text-zinc-400">{detail}</p>
		</div>
	);
}

function kpiRows(data: Kpis): { label: string; value: number }[] {
	return [
		{ label: "Verified", value: data.users.verified },
		{ label: "Suspended", value: data.users.suspended },
		{ label: "Free tier", value: data.tiers.free },
		{ label: "Taps", value: data.engagement.taps },
		{ label: "Conversations", value: data.engagement.conversations },
		{ label: "Blocks", value: data.engagement.blocks },
		{ label: "Favourites", value: data.engagement.favorites },
		{ label: "Profile views", value: data.engagement.footprints },
		{ label: "Notifications", value: data.system.notifications },
		{ label: "Avg trust score", value: data.system.avgTrustScore },
		{ label: "Pending verifications", value: data.system.pendingVerifications },
	];
}
