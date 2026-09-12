/**
 * The moderation queue. This exists because the app asks members to report, and
 * a report that goes nowhere is worse than no report button at all.
 *
 * Access is decided by the server (a moderator role read from `profiles.role`,
 * plus RLS on `reports` and `moderation_actions`). This page only renders what
 * `GET /api/session` already said the caller may see; the real gate is the API.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Ban,
	Check,
	ClipboardList,
	ExternalLink,
	RefreshCw,
	ShieldCheck,
	UserCheck,
} from "lucide-react";
import { useState } from "react";
import { useShell } from "#/components/AppShell";
import { Avatar } from "#/components/ui/Avatar";
import { Chip } from "#/components/ui/Chip";
import { Modal } from "#/components/ui/Modal";
import { describeFailure, StateBlock } from "#/components/ui/StateBlock";
import type {
	ModerationDetail,
	ModerationQueue,
	ModerationRow,
} from "#/lib/api-types";
import { api } from "#/lib/client";
import { useToasts } from "#/lib/toast";
import { cn, timeAgo } from "#/lib/utils";

export const Route = createFileRoute("/admin/")({
	component: AdminQueuePage,
	head: () => ({
		meta: [
			{ title: "Moderation — FYK" },
			{ name: "robots", content: "noindex" },
		],
	}),
});

const FILTERS = ["open", "in_review", "action_taken", "dismissed"] as const;
type Filter = (typeof FILTERS)[number];

const ACTIONS = [
	{
		id: "dismiss",
		label: "Dismiss",
		tone: "neutral",
		hint: "No violation found. The report is closed and the member is not told.",
	},
	{
		id: "warn",
		label: "Warn",
		tone: "gold",
		hint: "Mark the report actioned with a warning. FYK has no in-app warning delivery, so this is a record only.",
	},
	{
		id: "suspend",
		label: "Suspend",
		tone: "live",
		hint: "Sets profiles.is_suspended. RLS then hides the account from every other member; nothing is deleted.",
	},
	{
		id: "ban",
		label: "Ban",
		tone: "live",
		hint: "Same flag as a suspension — this build has no deletion pipeline, and pretending otherwise would be a false promise.",
	},
	{
		id: "reinstate",
		label: "Reinstate",
		tone: "neutral",
		hint: "Removes the suspension flag.",
	},
] as const;

function AdminQueuePage() {
	const { session, capable } = useShell();
	const queryClient = useQueryClient();
	const push = useToasts((state) => state.push);
	const [filter, setFilter] = useState<Filter>("open");
	const [selected, setSelected] = useState<string | null>(null);
	const [tab, setTab] = useState<"queue" | "audit">("queue");

	const queue = useQuery({
		queryKey: ["admin-queue", filter],
		queryFn: () => api.get<ModerationQueue>(`admin/queue?status=${filter}`),
		enabled: capable("moderation"),
		staleTime: 15_000,
	});

	const audit = useQuery({
		queryKey: ["admin-audit"],
		queryFn: () =>
			api.get<{
				actions: {
					id: string;
					action: string;
					note: string | null;
					created_at: string;
					actor_id: string;
				}[];
			}>("admin/audit"),
		enabled: capable("moderation") && tab === "audit",
	});

	const resolve = useMutation({
		mutationFn: ({
			reportId,
			action,
			note,
		}: {
			reportId: string;
			action: string;
			note?: string;
		}) =>
			api.post<{ status: string; suspended: boolean }>("admin/resolve", {
				reportId,
				action,
				note,
			}),
		onSuccess: (result) => {
			push(
				`Applied. Report is now ${result.status.replace(/_/g, " ")}.`,
				"success",
			);
			setSelected(null);
			void queryClient.invalidateQueries({ queryKey: ["admin-queue"] });
			void queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
		},
		onError: (error) =>
			push(
				error instanceof Error ? error.message : "That decision did not save.",
				"error",
			),
	});

	if (!capable("moderation")) {
		return (
			<StateBlock
				kind="disabled"
				title="You are not a moderator"
				description="This page calls an endpoint that checks your role in the database. If you believe you should have access, a current admin has to grant it — there is no self-service promotion and no header you can set."
			/>
		);
	}

	const failure = queue.error ? describeFailure(queue.error) : null;
	const reports = queue.data?.reports ?? [];

	return (
		<div className="mx-auto max-w-4xl">
			<header className="mb-4 flex flex-wrap items-center gap-2">
				<h1 className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.02em]">
					<ShieldCheck className="h-4.5 w-4.5 text-gold" /> Moderation
				</h1>
				<span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
					signed in as {session.role}
				</span>
				<div className="ml-auto flex items-center gap-1.5">
					<Chip active={tab === "queue"} onClick={() => setTab("queue")}>
						Queue
					</Chip>
					<Chip active={tab === "audit"} onClick={() => setTab("audit")}>
						Log
					</Chip>
					<button
						type="button"
						onClick={() => void queue.refetch()}
						className="press grid h-9 w-9 place-items-center rounded-full border border-line text-muted"
						aria-label="Refresh the queue"
					>
						<RefreshCw
							className={cn("h-4 w-4", queue.isFetching && "animate-spin")}
						/>
					</button>
				</div>
			</header>

			{tab === "audit" ? (
				<AuditPanel
					loading={audit.isPending}
					failure={audit.error ? describeFailure(audit.error).message : null}
					rows={audit.data?.actions ?? []}
				/>
			) : (
				<>
					<div className="mb-3 flex flex-wrap items-center gap-1.5">
						{FILTERS.map((entry) => (
							<Chip
								key={entry}
								active={filter === entry}
								onClick={() => setFilter(entry)}
							>
								{entry.replace(/_/g, " ")}
							</Chip>
						))}
						<span className="ml-auto text-[12px] text-faint">
							{queue.data ? `${reports.length} shown` : "…"}
						</span>
					</div>

					{queue.isPending ? (
						<ul className="space-y-2" aria-hidden="true">
							{[0, 1, 2, 3].map((index) => (
								<li key={index} className="skeleton h-24 rounded-2xl" />
							))}
						</ul>
					) : failure ? (
						<StateBlock
							kind="error"
							title="The queue could not load"
							description={failure.message}
							action={
								<button
									type="button"
									onClick={() => void queue.refetch()}
									className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black"
								>
									Try again
								</button>
							}
						/>
					) : reports.length === 0 ? (
						<StateBlock
							kind="empty"
							title={`Nothing in "${filter.replace(/_/g, " ")}"`}
							description="An empty queue is the goal. Reports appear here the moment they are filed, and urgent ones sort first."
						/>
					) : (
						<ul className="space-y-2">
							{reports.map((row) => (
								<li key={row.id}>
									<QueueRow row={row} onOpen={() => setSelected(row.id)} />
								</li>
							))}
						</ul>
					)}
				</>
			)}

			{selected && (
				<ReportDetail
					reportId={selected}
					onClose={() => setSelected(null)}
					onResolve={(action, note) =>
						resolve.mutate({ reportId: selected, action, note })
					}
					busy={resolve.isPending}
					canManageRoles={session.role === "admin"}
				/>
			)}
		</div>
	);
}

function QueueRow({ row, onOpen }: { row: ModerationRow; onOpen: () => void }) {
	const urgent = row.severity === "urgent";
	return (
		<article
			className={cn(
				"rounded-2xl border bg-surface p-3.5",
				urgent ? "border-live/40" : "border-line",
			)}
		>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						"mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
						urgent ? "bg-live/10 text-live" : "bg-surface-2 text-gold",
					)}
				>
					{urgent ? (
						<AlertTriangle className="h-4 w-4" />
					) : (
						<ClipboardList className="h-4 w-4" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-semibold text-ink">
						{row.reason.replace(/_/g, " ")}
						<span className="text-[12px] font-normal text-muted">
							on {row.targetType.replace(/_/g, " ")}
						</span>
						{row.duplicateCount > 1 ? (
							<span className="rounded-full bg-live/10 px-1.5 text-[11px] font-bold text-live">
								{row.duplicateCount} reports
							</span>
						) : null}
					</p>
					<p className="mt-1 text-[12.5px] leading-relaxed text-muted">
						{row.details
							? row.details
							: "No extra detail was given by the reporter."}
					</p>
					{row.target ? (
						<p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
							<Avatar name={row.target.displayName} size={20} />
							<span className="font-semibold">{row.target.displayName}</span>
							{row.target.handle ? (
								<span className="font-mono text-[11.5px] text-faint">
									@{row.target.handle}
								</span>
							) : null}
							{row.target.age ? (
								<span className="text-faint">· {row.target.age}</span>
							) : null}
							<span
								className={row.target.suspended ? "text-live" : "text-faint"}
							>
								· {row.target.suspended ? "suspended" : "active"}
							</span>
							<span className="text-faint">
								· joined{" "}
								{row.target.joinedAt
									? timeAgo(String(row.target.joinedAt))
									: "unknown"}
							</span>
						</p>
					) : (
						<p className="mt-2 text-[12px] text-faint">
							Target is not a profile ({row.targetType}) — open it for the raw
							record.
						</p>
					)}
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1.5">
					<span className="text-[11px] text-faint">
						{timeAgo(row.createdAt)}
					</span>
					<button
						type="button"
						onClick={onOpen}
						className="press h-8 rounded-full border border-line px-2.5 text-[12px] font-semibold text-ink-2 hover:text-ink"
					>
						Review
					</button>
				</div>
			</div>
		</article>
	);
}

function ReportDetail({
	reportId,
	onClose,
	onResolve,
	busy,
	canManageRoles,
}: {
	reportId: string;
	onClose: () => void;
	onResolve: (action: string, note?: string) => void;
	busy: boolean;
	canManageRoles: boolean;
}) {
	const detail = useQuery({
		queryKey: ["admin-report", reportId],
		queryFn: () => api.get<ModerationDetail>(`admin/reports/${reportId}`),
	});
	const push = useToasts((state) => state.push);
	const [note, setNote] = useState("");

	const setRole = useMutation({
		mutationFn: ({
			profileId,
			role,
		}: {
			profileId: string;
			role: "user" | "moderator" | "admin";
		}) => api.post<{ role: string }>("admin/role", { profileId, role }),
		onSuccess: (result) => push(`Role is now ${result.role}.`, "success"),
		onError: (error) =>
			push(
				error instanceof Error ? error.message : "That did not save.",
				"error",
			),
	});

	const targetProfileId =
		detail.data?.report?.target_type === "profile"
			? String(detail.data.report.target_id)
			: null;
	const failure = detail.error ? describeFailure(detail.error) : null;

	return (
		<Modal open onClose={onClose} labelledBy="report-detail" wide>
			<div className="p-5 sm:p-6">
				<h2 id="report-detail" className="text-[17px] font-bold">
					Report detail
				</h2>
				{detail.isPending ? (
					<StateBlock kind="loading" title="Loading" />
				) : failure ? (
					<StateBlock
						kind="error"
						title="This report could not open"
						description={failure.message}
					/>
				) : (
					<>
						<dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
							<div className="rounded-xl border border-line bg-surface-2 p-2.5">
								<dt className="text-[11px] uppercase tracking-wide text-faint">
									Reason
								</dt>
								<dd className="mt-0.5 font-semibold text-ink">
									{String(detail.data?.report?.reason ?? "").replace(/_/g, " ")}
								</dd>
							</div>
							<div className="rounded-xl border border-line bg-surface-2 p-2.5">
								<dt className="text-[11px] uppercase tracking-wide text-faint">
									State
								</dt>
								<dd className="mt-0.5 font-semibold text-ink">
									{String(detail.data?.report?.status ?? "").replace(/_/g, " ")}
								</dd>
							</div>
							{detail.data?.report?.details ? (
								<p className="sm:col-span-2 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-2.5 text-[13px] leading-relaxed text-ink-2">
									{String(detail.data.report.details)}
								</p>
							) : null}
						</dl>

						{detail.data?.priorAgainstTarget &&
							detail.data.priorAgainstTarget.length > 0 && (
								<div className="mt-3 rounded-xl border border-gold/30 bg-gold-ghost p-3">
									<p className="text-[12px] font-semibold text-gold">
										{detail.data.priorAgainstTarget.length} earlier report
										{detail.data.priorAgainstTarget.length === 1 ? "" : "s"}{" "}
										against this target
									</p>
									<ul className="mt-1.5 space-y-1 text-[12px] text-muted">
										{detail.data.priorAgainstTarget.map((prior) => (
											<li key={String(prior.id)}>
												{String(prior.reason).replace(/_/g, " ")} ·{" "}
												{String(prior.status).replace(/_/g, " ")} ·{" "}
												{timeAgo(String(prior.created_at))}
											</li>
										))}
									</ul>
								</div>
							)}

						{detail.data?.history?.length ? (
							<div className="mt-3">
								<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
									Actions on this report
								</p>
								<ul className="mt-1.5 space-y-1 text-[12.5px] text-muted">
									{detail.data.history.map((entry) => (
										<li key={entry.id}>
											<span className="font-semibold text-ink-2">
												{entry.action}
											</span>{" "}
											· {timeAgo(entry.created_at)}
											{entry.note ? ` — ${entry.note}` : ""}
										</li>
									))}
								</ul>
							</div>
						) : null}

						<label className="mt-4 block">
							<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
								Decision note (required to suspend or ban)
							</span>
							<textarea
								value={note}
								onChange={(event) => setNote(event.target.value)}
								rows={2}
								maxLength={1000}
								placeholder="What you saw and why you acted. This is stored in the append-only moderation log."
								className="entry-input resize-none"
							/>
						</label>

						<div className="mt-4 grid gap-2 sm:grid-cols-2">
							{ACTIONS.map((action) => (
								<button
									key={action.id}
									type="button"
									disabled={busy}
									onClick={() => onResolve(action.id, note.trim() || undefined)}
									className={cn(
										"press flex items-start gap-2 rounded-xl border p-3 text-left disabled:opacity-60",
										action.tone === "live"
											? "border-live/40 hover:border-live"
											: "border-line hover:border-gold/40",
									)}
								>
									<span className="mt-0.5 shrink-0 text-gold">
										{action.id === "dismiss" ? (
											<Check className="h-4 w-4" />
										) : action.id === "reinstate" ? (
											<UserCheck className="h-4 w-4" />
										) : (
											<Ban className="h-4 w-4" />
										)}
									</span>
									<span className="min-w-0">
										<span className="block text-[13px] font-semibold text-ink">
											{action.label}
										</span>
										<span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
											{action.hint}
										</span>
									</span>
								</button>
							))}
						</div>

						{canManageRoles && targetProfileId ? (
							<div className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
								<p className="text-[12px] font-semibold text-ink-2">
									Moderation role for this member
								</p>
								<p className="mt-1 text-[11.5px] leading-relaxed text-muted">
									Admin only. The role is a column on the profile row and is
									checked in SQL on every queue request, so promoting someone
									here is the same act as granting them the queue.
								</p>
								<div className="mt-2 flex flex-wrap gap-1.5">
									{(["user", "moderator", "admin"] as const).map((role) => (
										<button
											key={role}
											type="button"
											disabled={setRole.isPending}
											onClick={() => {
												if (
													window.confirm(`Set this member's role to ${role}?`)
												)
													setRole.mutate({ profileId: targetProfileId, role });
											}}
											className="press h-9 rounded-full border border-line px-3 text-[12.5px] font-semibold text-ink-2 hover:border-gold/40"
										>
											{role}
										</button>
									))}
								</div>
							</div>
						) : null}

						<div className="mt-4 flex items-center gap-2">
							<button
								type="button"
								onClick={onClose}
								className="press h-11 rounded-full border border-line px-4 text-[13.5px] font-semibold text-ink-2"
							>
								Close
							</button>
							<a
								href={`/profile/${String(detail.data?.report?.target_id ?? "")}`}
								className="press ml-auto flex h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-muted"
							>
								<ExternalLink className="h-3.5 w-3.5" /> Open target profile
							</a>
						</div>
					</>
				)}
			</div>
		</Modal>
	);
}

function AuditPanel({
	loading,
	failure,
	rows,
}: {
	loading: boolean;
	failure: string | null;
	rows: {
		id: string;
		action: string;
		note: string | null;
		created_at: string;
		actor_id: string;
	}[];
}) {
	return (
		<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
			<h2 className="text-[16px] font-bold">Decision log</h2>
			<p className="mt-1 text-[12.5px] leading-relaxed text-muted">
				Append-only. A moderator cannot edit or delete a past decision, which is
				the only reason the log is worth reading.
			</p>
			{loading ? (
				<StateBlock className="mt-4" kind="loading" title="Loading the log" />
			) : failure ? (
				<StateBlock
					className="mt-4"
					kind="error"
					title="The log could not load"
					description={failure}
				/>
			) : rows.length === 0 ? (
				<StateBlock
					className="mt-4"
					kind="empty"
					title="No decisions recorded yet"
					description="Every action taken from the queue appears here with the moderator's id, the action, and its note."
				/>
			) : (
				<ul className="mt-4 space-y-1.5">
					{rows.map((entry) => (
						<li
							key={entry.id}
							className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[12.5px]"
						>
							<span className="min-w-0 flex-1">
								<span className="font-semibold text-ink">{entry.action}</span>
								{entry.note ? (
									<span className="mt-0.5 block leading-relaxed text-muted">
										{entry.note}
									</span>
								) : null}
								<span className="mt-0.5 block font-mono text-[11px] text-faint">
									by {entry.actor_id.slice(0, 8)}…
								</span>
							</span>
							<span className="shrink-0 text-[11px] text-faint">
								{timeAgo(entry.created_at)}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
