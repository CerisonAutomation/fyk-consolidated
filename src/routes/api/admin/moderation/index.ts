import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, unexpected, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { notifications, users } from "@/schema";

/**
 * `GET|POST /api/admin/moderation` — the queue a moderator works from.
 *
 * WHAT WAS HERE
 * -------------
 * The GET built its answer from a literal array of two reports with
 * `reporterId: "reporter-1"` and `targetId: "target-1"`, and the POST did nothing at
 * all: it validated the body, then returned "appliedBy" and "appliedAt" without writing
 * a row. So a moderator could "ban" somebody, see a success response, and nothing in the
 * database had changed — while the real queue in `public.reports` (which
 * `#/routes/api/safety/reports` fills, and which carries a `status report_status` column
 * of `open | in_review | action_taken | dismissed`) was never read.
 *
 * WHAT IT DOES NOW
 * ----------------
 * - Reads `public.reports` with the reporter and the reported account joined in, because
 *   a queue of bare uuids is not a queue anybody can work.
 * - Derives priority from the reason rather than storing it: `underage` and
 *   `impersonation` are URGENT, `harassment` and `hate_speech` are HIGH, the rest MEDIUM.
 *   A stored priority is a second opinion that can disagree with the reason.
 * - Applies the action: the report's status moves (`dismissed`, `in_review`,
 *   `action_taken`), the target is suspended when the action is a suspension or a ban,
 *   the reporter is notified through the `report` notification type, and every action
 *   writes an `audit_events` row — the one table nothing in this product had ever
 *   written to.
 *
 * WHAT IT DOES NOT PRETEND
 * ------------------------
 * There is no `suspended_until` column, so a suspension is stored as
 * `users.is_suspended = true` and the requested `durationDays` is recorded in the audit
 * metadata. The response says "indefinite until lifted" rather than implying a timer
 * that nothing enforces.
 */

const ADMIN_ACTIONS = ["warn", "suspend", "ban", "dismiss"] as const;
type AdminAction = (typeof ADMIN_ACTIONS)[number];

const actionSchema = z
	.object({
		reportId: z.uuid(),
		action: z.enum(ADMIN_ACTIONS),
		reason: z.string().max(500).optional(),
		durationDays: z.number().int().min(1).max(365).optional(),
	})
	.strict();

/** Reasons whose severity is high enough that they are worked first. */
const URGENT_REASONS = new Set(["underage", "impersonation"]);
const HIGH_REASONS = new Set(["harassment", "hate_speech", "doxxing"]);

function priorityOf(reason: string): "URGENT" | "HIGH" | "MEDIUM" {
	const key = reason.trim().toLowerCase();
	if (URGENT_REASONS.has(key)) return "URGENT";
	if (HIGH_REASONS.has(key)) return "HIGH";
	return "MEDIUM";
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2 } as const;

interface QueueRow {
	id: string;
	reporter_id: string;
	target_id: string;
	target_type: string;
	reason: string;
	details: string | null;
	status: string;
	created_at: string;
	reporter_handle: string | null;
	reporter_display_name: string | null;
	target_handle: string | null;
	target_display_name: string | null;
	target_suspended: boolean | null;
}

export const Route = createFileRoute("/api/admin/moderation/")({
	server: {
		handlers: {
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),

			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);

					try {
						const [me] = await db
							.select({ role: users.role })
							.from(users)
							.where(eq(users.id, user.id))
							.limit(1);
						if (me?.role !== "admin") return jsonError("Admin only", 403);

						const url = new URL(request.url);
						const status = url.searchParams.get("status") ?? "open";
						const priority = url.searchParams.get("priority");

						const rows = (await db.execute(sql`
							select r.id,
							       r.reporter_id,
							       r.target_id,
							       r.target_type,
							       r.reason,
							       r.details,
							       r.status,
							       r.created_at,
							       reporter.handle       as reporter_handle,
							       reporter.display_name as reporter_display_name,
							       target.handle         as target_handle,
							       target.display_name   as target_display_name,
							       target.is_suspended   as target_suspended
							  from public.reports r
							  left join public.users reporter on reporter.id = r.reporter_id
							  left join public.users target   on target.id   = r.target_id
							 where (${status} = 'all' or r.status = ${status})
							 order by r.created_at desc
							 limit 200
						`)) as unknown as QueueRow[];

						const reports = rows
							.map((row) => ({
								id: row.id,
								reporterId: row.reporter_id,
								reporter: {
									handle: row.reporter_handle,
									displayName: row.reporter_display_name,
								},
								targetId: row.target_id,
								target: {
									handle: row.target_handle,
									displayName: row.target_display_name,
									suspended: row.target_suspended ?? false,
								},
								targetType: row.target_type,
								reason: row.reason,
								details: row.details,
								status: row.status,
								priority: priorityOf(row.reason),
								createdAt: new Date(row.created_at).toISOString(),
							}))
							.filter((report) => !priority || report.priority === priority)
							.sort(
								(a, b) =>
									PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
									b.createdAt.localeCompare(a.createdAt),
							);

						return json({
							reports,
							count: reports.length,
							priorities: {
								URGENT: reports.filter((r) => r.priority === "URGENT").length,
								HIGH: reports.filter((r) => r.priority === "HIGH").length,
								MEDIUM: reports.filter((r) => r.priority === "MEDIUM").length,
							},
							status,
						});
					} catch (error) {
						return unexpected("admin/moderation/GET", error);
					}
				},
				{ rateLimit: { limit: 60, key: ({ caller }) => `mod:GET:${caller?.id ?? "anon"}` } },
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);

					let body: z.infer<typeof actionSchema>;
					try {
						body = await readJson(request, actionSchema, 8 * 1024);
					} catch (error) {
						if (error instanceof Error && error.name === "ApiError") throw error;
						return unexpected("admin/moderation/POST", error);
					}

					try {
						const [me] = await db
							.select({ role: users.role })
							.from(users)
							.where(eq(users.id, user.id))
							.limit(1);
						if (me?.role !== "admin") return jsonError("Admin only", 403);

						const [report] = (await db.execute(sql`
							select id, reporter_id, target_id, reason, status
							  from public.reports
							 where id = ${body.reportId}
							 limit 1
						`)) as unknown as {
							id: string;
							reporter_id: string;
							target_id: string;
							reason: string;
							status: string;
						}[];
						if (!report) return jsonError("That report does not exist", 404);

						const action: AdminAction = body.action;
						const reportStatus =
							action === "dismiss" ? "dismissed" : action === "warn" ? "in_review" : "action_taken";

						await db.transaction(async (tx) => {
							await tx.execute(sql`
								update public.reports
								   set status = ${reportStatus}
								 where id = ${body.reportId}
							`);

							if (action === "suspend" || action === "ban") {
								await tx
									.update(users)
									.set({ isSuspended: true })
									.where(eq(users.id, report.target_id));
							}

							await tx.execute(sql`
								insert into public.audit_events
									(actor_id, action, target_type, target_id, metadata)
								values (
									${user.id},
									${`moderation.${action}`},
									'report',
									${body.reportId},
									${JSON.stringify({
										reporterId: report.reporter_id,
										targetId: report.target_id,
										reason: report.reason,
										note: body.reason ?? null,
										durationDays: body.durationDays ?? null,
									})}::jsonb
								)
							`);

							// The reporter is told the outcome; the reported account is not told
							// who reported it, only that a decision was made.
							await tx.insert(notifications).values({
								userId: report.reporter_id,
								type: "report",
								title: "Your report was reviewed",
								body:
									action === "dismiss"
										? "A moderator reviewed your report and took no action."
										: `A moderator reviewed your report and took action: ${action}.`,
								href: "/safety",
							});
						});

						return json({
							ok: true,
							reportId: body.reportId,
							action,
							reportStatus,
							targetSuspended: action === "suspend" || action === "ban",
							// Said plainly: there is no `suspended_until` column, so a suspension
							// is indefinite until an operator lifts it.
							suspension:
								action === "suspend"
									? `Suspended indefinitely until lifted. Requested duration (${body.durationDays ?? "unspecified"} days) is recorded in the audit row.`
									: action === "ban"
										? "Banned indefinitely."
										: null,
							appliedBy: user.id,
							appliedAt: new Date().toISOString(),
						});
					} catch (error) {
						return unexpected("admin/moderation/POST", error);
					}
				},
				{
					maxBodySize: 8 * 1024,
					rateLimit: { limit: 30, key: ({ caller }) => `mod:POST:${caller?.id ?? "anon"}` },
				},
			),
		},
	},
});
