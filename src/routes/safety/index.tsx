import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	Ban,
	Eye,
	Loader2,
	LockKeyhole,
	RefreshCw,
	ShieldAlert,
	ShieldCheck,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { useShell } from "#/components/AppShell";
import { Avatar } from "#/components/ui/Avatar";
import { Chip } from "#/components/ui/Chip";
import { describeFailure, StateBlock } from "#/components/ui/StateBlock";
import type { BlockedRow, ReportRow, ViewRow } from "#/lib/api-types";
import { api } from "#/lib/client";
import { useToasts } from "#/lib/toast";
import { cn, timeAgo } from "#/lib/utils";

export const Route = createFileRoute("/safety/")({
	component: SafetyPage,
	head: () => ({ meta: [{ title: "Safety — FYK" }] }),
});

type Tab = "reports" | "blocks" | "views" | "help";

function SafetyPage() {
	const { capable } = useShell();
	const [tab, setTab] = useState<Tab>("reports");

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-4 flex flex-wrap gap-1.5">
				<Chip active={tab === "reports"} onClick={() => setTab("reports")}>
					My reports
				</Chip>
				<Chip active={tab === "blocks"} onClick={() => setTab("blocks")}>
					Blocked
				</Chip>
				<Chip active={tab === "views"} onClick={() => setTab("views")}>
					Profile views
				</Chip>
				<Chip
					active={tab === "help"}
					onClick={() => setTab("help")}
					tone="live"
				>
					Get help
				</Chip>
			</div>

			{tab === "reports" && <ReportsTab enabled={capable("reports")} />}
			{tab === "blocks" && <BlocksTab />}
			{tab === "views" && <ViewsTab />}
			{tab === "help" && <HelpTab />}
		</div>
	);
}

function ReportsTab({ enabled }: { enabled: boolean }) {
	const queryClient = useQueryClient();
	const { data, isPending, error, refetch } = useQuery({
		queryKey: ["reports"],
		queryFn: () => api.get<{ reports: ReportRow[] }>("reports"),
		enabled,
	});
	const failure = error ? describeFailure(error) : null;
	const reports = data?.reports ?? [];

	if (!enabled)
		return (
			<StateBlock
				kind="disabled"
				title="Reporting is unavailable"
				description="The reports table is not readable for your account, so reports cannot be filed or tracked."
			/>
		);

	return (
		<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
			<h2 className="flex items-center gap-2 text-[16px] font-bold">
				<ShieldAlert className="h-4 w-4 text-gold" /> What you have reported
			</h2>
			<p className="mt-1 text-[12.5px] leading-relaxed text-muted">
				You will not be told what happened to the other account — outcomes are a
				moderation decision, not a chat weapon. You will see the state of your
				own report.
			</p>

			{isPending ? (
				<StateBlock
					className="mt-4"
					kind="loading"
					title="Loading your reports"
				/>
			) : failure ? (
				<StateBlock
					className="mt-4"
					kind="error"
					title="Your reports could not load"
					description={failure.message}
					action={
						<button
							type="button"
							onClick={() => void refetch()}
							className="press h-10 rounded-full bg-gold px-3.5 text-[13px] font-bold text-black"
						>
							Try again
						</button>
					}
				/>
			) : reports.length === 0 ? (
				<StateBlock
					className="mt-4"
					kind="empty"
					title="You have not reported anything"
					description="That is a good default. If you do need to report someone, the shield icon on any profile, Board post, message or event opens the form."
				/>
			) : (
				<ul className="mt-4 space-y-2">
					{reports.map((report) => (
						<li
							key={report.id}
							className="rounded-xl border border-line bg-surface-2 p-3"
						>
							<div className="flex items-start gap-2">
								<span className="min-w-0 flex-1">
									<span className="block text-[13.5px] font-semibold text-ink">
										{reasonLabel(report.reason)}
									</span>
									<span className="mt-0.5 block text-[12px] text-muted">
										{targetLabel(report.targetType)} · filed{" "}
										{timeAgo(report.createdAt)}
									</span>
								</span>
								<span
									className={cn(
										"shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
										STATUS_TONE[report.status] ?? "border-line text-muted",
									)}
									title={`Queue state: ${report.status.replace(/_/g, " ")}`}
								>
									{statusLabel(report.status)}
								</span>
							</div>
							{report.severity === "urgent" && (
								<p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-live">
									<AlertTriangle className="h-3.5 w-3.5" /> Flagged urgent by
									the database, so it sits at the top of the queue.
								</p>
							)}
						</li>
					))}
				</ul>
			)}

			{reports.length > 0 && (
				<button
					type="button"
					onClick={() =>
						void queryClient.invalidateQueries({ queryKey: ["reports"] })
					}
					className="press mt-3 flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-ink-2"
				>
					<RefreshCw className="h-3.5 w-3.5" /> Check for updates
				</button>
			)}
		</section>
	);
}

const REASONS: Record<string, string> = {
	harassment: "Harassment or bullying",
	threat: "Threats of violence",
	doxxing: "Private details shared",
	underage: "Someone under 18",
	inappropriate_content: "Inappropriate content",
	fake_profile: "Fake or impersonation",
	spam: "Spam or scam",
	other: "Something else",
};

const STATUS_TONE: Record<string, string> = {
	open: "border-gold/40 text-gold",
	in_review: "border-violet/40 text-violet",
	action_taken: "border-emerald/40 text-emerald",
	dismissed: "border-line text-faint",
};

function reasonLabel(reason: string) {
	return REASONS[reason] ?? "A report";
}

function targetLabel(type: string) {
	if (type === "profile") return "a member";
	if (type === "message") return "a message";
	if (type === "board_post") return "a Board post";
	if (type === "event") return "an event";
	if (type === "album") return "a private album";
	return "something";
}

function statusLabel(status: string) {
	if (status === "open") return "In queue";
	if (status === "in_review") return "Being reviewed";
	if (status === "action_taken") return "Action taken";
	if (status === "dismissed") return "Closed";
	return status.replace(/_/g, " ");
}

function BlocksTab() {
	const push = useToasts((state) => state.push);
	const queryClient = useQueryClient();
	const { data, isPending, error, refetch } = useQuery({
		queryKey: ["blocks"],
		queryFn: () => api.get<{ blocked: BlockedRow[] }>("blocks"),
	});
	const unblock = useMutation({
		mutationFn: (id: string) => api.del<{ blocked: boolean }>(`blocks/${id}`),
		onSuccess: () => {
			push("Unblocked. They can find you in Nearby again.", "success");
			void queryClient.invalidateQueries({ queryKey: ["blocks"] });
		},
		onError: (err) =>
			push(err instanceof Error ? err.message : "That did not work.", "error"),
	});

	const failure = error ? describeFailure(error) : null;
	const blocked = data?.blocked ?? [];

	return (
		<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
			<h2 className="flex items-center gap-2 text-[16px] font-bold">
				<Ban className="h-4 w-4 text-gold" /> Blocked members
			</h2>
			<p className="mt-1 text-[12.5px] leading-relaxed text-muted">
				A block is enforced in the database: you disappear from their Nearby,
				their chats cannot send to you, and your profile stops loading for them.
				They are not told about it.
			</p>

			{isPending ? (
				<StateBlock
					className="mt-4"
					kind="loading"
					title="Loading your block list"
				/>
			) : failure ? (
				<StateBlock
					className="mt-4"
					kind="error"
					title="Your blocks could not load"
					description={failure.message}
					action={
						<button
							type="button"
							onClick={() => void refetch()}
							className="press h-10 rounded-full bg-gold px-3.5 text-[13px] font-bold text-black"
						>
							Try again
						</button>
					}
				/>
			) : blocked.length === 0 ? (
				<StateBlock
					className="mt-4"
					kind="empty"
					title="Nobody is blocked"
					description="Blocking is available from any profile, chat header, or Board post."
				/>
			) : (
				<ul className="mt-4 space-y-1.5">
					{blocked.map((entry) => (
						<li
							key={entry.id}
							className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
						>
							<Avatar
								name={entry.displayName}
								photoUrl={entry.avatarUrl}
								size={34}
							/>
							<span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-2">
								{entry.displayName}
							</span>
							<button
								type="button"
								disabled={unblock.isPending}
								onClick={() => unblock.mutate(entry.id)}
								className="press flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
							>
								{unblock.isPending ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<X className="h-3.5 w-3.5" />
								)}{" "}
								Unblock
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function ViewsTab() {
	const [limit, setLimit] = useState(12);
	const { data, isPending, error, refetch } = useQuery({
		queryKey: ["views"],
		queryFn: () => api.get<{ views: ViewRow[] }>("views"),
	});
	const failure = error ? describeFailure(error) : null;
	const views = data?.views ?? [];

	return (
		<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
			<h2 className="flex items-center gap-2 text-[16px] font-bold">
				<Eye className="h-4 w-4 text-gold" /> Who looked at your profile
			</h2>
			<p className="mt-1 text-[12.5px] leading-relaxed text-muted">
				Views are recorded only when you are not in incognito mode, and this
				list is visible to you alone. There is no "who liked you" tier and
				nothing is sold here.
			</p>

			{isPending ? (
				<StateBlock
					className="mt-4"
					kind="loading"
					title="Loading profile views"
				/>
			) : failure ? (
				<StateBlock
					className="mt-4"
					kind="error"
					title="Profile views could not load"
					description={failure.message}
					action={
						<button
							type="button"
							onClick={() => void refetch()}
							className="press h-10 rounded-full bg-gold px-3.5 text-[13px] font-bold text-black"
						>
							Try again
						</button>
					}
				/>
			) : views.length === 0 ? (
				<StateBlock
					className="mt-4"
					kind="empty"
					title="No recent profile views"
					description="Either nobody has opened your profile, or you were in incognito while looking around — that hides you, and the same setting means your own views are not recorded."
				/>
			) : (
				<>
					<ul className="mt-4 space-y-1.5">
						{views.slice(0, limit).map((view) => (
							<li
								key={`${view.profileId}-${view.viewedAt}`}
								className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
							>
								<Avatar
									name={view.displayName}
									photoUrl={view.avatarUrl}
									size={34}
								/>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[13.5px] font-semibold text-ink-2">
										{view.displayName}
									</span>
									<span className="block text-[11.5px] text-muted">
										{view.age ? `${view.age} · ` : ""}
										{timeAgo(view.viewedAt)}
									</span>
								</span>
							</li>
						))}
					</ul>
					{views.length > limit && (
						<button
							type="button"
							onClick={() => setLimit(views.length)}
							className="press mt-3 h-10 rounded-full border border-line px-4 text-[12.5px] font-semibold text-ink-2"
						>
							Show all {views.length}
						</button>
					)}
				</>
			)}
		</section>
	);
}

function HelpTab() {
	const { session } = useShell();
	const navigate = useNavigate();
	return (
		<div className="space-y-4">
			<section className="rounded-2xl border border-live/30 bg-live/5 p-4 sm:p-5">
				<h2 className="flex items-center gap-2 text-[16px] font-bold text-live">
					<AlertTriangle className="h-4 w-4" /> If you are in danger right now
				</h2>
				<p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
					Call your local emergency number. FYK is an app, not an emergency
					service: we cannot see your location, we cannot dispatch anyone, and a
					report here is not a priority line.
				</p>
			</section>

			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
				<h2 className="flex items-center gap-2 text-[16px] font-bold">
					<ShieldCheck className="h-4 w-4 text-gold" /> What FYK actually
					enforces
				</h2>
				<ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed">
					{[
						[
							"18 and over only",
							"Your date of birth is stored privately, the age is derived in the database, and a row that is not 18+ is rejected by a trigger — not by the client.",
						],
						[
							"Blocks are database-level",
							"A blocked pair cannot read each other's rows at all, because row-level security refuses it. Nothing a browser can toggle bypasses that.",
						],
						[
							"Reports go to a human queue",
							"Your report lands in a moderation queue with a severity set by a trigger. Urgent reasons (minors, threats, doxxing) sort to the top.",
						],
						[
							"Photos are yours to manage",
							"Remove any photo at any time from Settings → Photos. Chat media is private and served through short-lived signed links.",
						],
					].map(([title, body]) => (
						<li
							key={title}
							className="rounded-xl border border-line bg-surface-2 p-3"
						>
							<p className="font-semibold text-ink">{title}</p>
							<p className="mt-0.5 text-[12.5px] text-muted">{body}</p>
						</li>
					))}
				</ul>
			</section>

			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
				<h2 className="flex items-center gap-2 text-[16px] font-bold">
					<LockKeyhole className="h-4 w-4 text-gold" /> What FYK does not do
				</h2>
				<ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-muted">
					<li>
						· No end-to-end encryption. Messages are stored so moderators can
						act on reports; the transport is HTTPS and access is row-level
						security.
					</li>
					<li>
						· No anonymous mode, no screenshots of other people's private
						photos, no admin browsing of chats without a report trail.
					</li>
					<li>
						· No push notifications. Activity is listed here and in the bell,
						refreshed while the app is open.
					</li>
					<li>
						· No algorithm deciding who you meet. Nearby is distance and
						recency; that is the whole ranking.
					</li>
				</ul>
				<p className="mt-3 text-[12.5px] leading-relaxed text-faint">
					These limits are stated because a safety screen that overpromises is
					worse than one that underpromises.
				</p>
			</section>

			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
				<h2 className="flex items-center gap-2 text-[16px] font-bold">
					<Users className="h-4 w-4 text-gold" /> Meeting in person
				</h2>
				<ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-muted">
					<li>
						· First meet in public, during the day, and tell someone where you
						are.
					</li>
					<li>
						· Keep your own transport. Do not accept a ride to a private
						location from someone you just matched.
					</li>
					<li>
						· The Board is for plans, so read the whole post — capacity and
						expiry are enforced, other details are not.
					</li>
					<li>
						· If a date turns into pressure, block first and report second. Both
						are one tap from any profile.
					</li>
				</ul>
				<div className="mt-4 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => void navigate({ to: "/grid" })}
						className="press flex h-11 items-center gap-2 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black"
					>
						<ShieldAlert className="h-4 w-4" /> Back to Nearby
					</button>
					{session.role !== "user" && (
						<button
							type="button"
							onClick={() => void navigate({ to: "/admin" })}
							className="press h-11 rounded-full border border-gold/40 px-4 text-[13.5px] font-semibold text-gold"
						>
							Open the moderation queue
						</button>
					)}
				</div>
			</section>
		</div>
	);
}
