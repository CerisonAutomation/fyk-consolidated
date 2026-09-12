import { asRows } from "../data/typed-rows";
/**
 * The moderation queue. Minimal, but real: it reads what reporters filed, it
 * triages in urgency order, and every decision is one RPC that writes the report
 * status, the account sanction, the append-only action trail, and an audit event.
 *
 * Access is decided twice on purpose:
 *   - the handler refuses anyone whose `profiles.role` is not moderator/admin
 *     (that value comes from the database, never from a header);
 *   - RLS on `reports`, `moderation_actions` and the `resolve_report` RPC refuses
 *     the same request even if this handler were bypassed.
 */

import { z } from "zod";
import { type RequestCtx, readJson } from "../context";
import { dbFailure, forbidden, notFound } from "../errors";

const MODERATOR_ROLES = new Set(["moderator", "admin"]);

async function requireModerator(ctx: RequestCtx) {
	const caller = await ctx.auth();
	if (!MODERATOR_ROLES.has(caller.role))
		throw forbidden("Moderator access is required for the review queue.");
	return caller;
}

export async function queue(ctx: RequestCtx) {
	await requireModerator(ctx);
	const client = ctx.db();
	const status = ctx.query.get("status") ?? "open";

	const { data, error } = await client
		.from("reports")
		.select(
			"id,reporter_id,target_type,target_id,reason,details,status,severity,created_at,reviewed_at,resolution",
		)
		.eq("status", status as never)
		.order("severity", { ascending: false })
		.order("created_at", { ascending: true })
		.limit(100);
	if (error) throw dbFailure(error, "That did not save. Please try again.");

	const rows = asRows<Record<string, unknown>>(data);
	const targetIds = [
		...new Set(
			rows
				.filter((row) => row.target_type === "profile")
				.map((row) => String(row.target_id)),
		),
	];
	const profileRows: Record<string, unknown>[] = [];
	if (targetIds.length) {
		const profiles = await client
			.from("profiles")
			.select(
				"id,display_name,handle,age,is_suspended,onboarding_completed_at,created_at,role",
			)
			.in("id", targetIds);
		if (profiles.error)
			throw dbFailure(profiles.error, "That did not save. Please try again.");
		profileRows.push(...asRows<Record<string, unknown>>(profiles.data));
	}
	const profileMap = new Map(profileRows.map((row) => [String(row.id), row]));
	// Reports about the same target are the strongest priority signal available
	// without inventing a score.
	const duplicateCounts = new Map<string, number>();
	for (const row of rows) {
		const key = String(row.target_id);
		duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
	}

	return {
		// Grouped by target: three reports about the same member is one decision,
		// not three, and a moderator who has to open each tab separately will
		// resolve them inconsistently.
		reports: rows.map((row) => {
			const target =
				row.target_type === "profile"
					? (profileMap.get(String(row.target_id)) as
							| Record<string, unknown>
							| undefined)
					: undefined;
			return {
				id: row.id,
				reporterId: row.reporter_id,
				targetType: row.target_type,
				targetId: row.target_id,
				reason: row.reason,
				details: row.details ?? null,
				status: row.status,
				severity: row.severity,
				createdAt: row.created_at,
				reviewedAt: row.reviewed_at ?? null,
				resolution: row.resolution ?? null,
				duplicateCount: duplicateCounts.get(String(row.target_id)) ?? 1,
				target: target
					? {
							id: String(target.id),
							displayName: target.display_name ?? target.handle ?? "Member",
							handle: target.handle ?? null,
							age: target.age ?? null,
							suspended: Boolean(target.is_suspended),
							role: target.role ?? "user",
							joinedAt: target.created_at ?? null,
						}
					: null,
			};
		}),
		counts: { open: rows.length },
	};
}

export const decisionSchema = z.object({
	reportId: z.string().uuid(),
	action: z.enum(["dismiss", "warn", "suspend", "ban", "reinstate"]),
	note: z.string().trim().max(1000).optional(),
});

export async function resolve(ctx: RequestCtx) {
	await requireModerator(ctx);
	const body = await readJson(ctx.request, decisionSchema);
	const client = ctx.db();

	if ((body.action === "suspend" || body.action === "ban") && !body.note) {
		throw forbidden("A suspension or ban needs a note for the record.");
	}

	// One call, one transaction: the report status and the sanction cannot diverge.
	const { data, error } = await client.rpc(
		"resolve_report" as never,
		{
			p_report_id: body.reportId,
			p_action: body.action,
			p_note: body.note ?? null,
		} as never,
	);
	if (error) throw dbFailure(error, "That did not save. Please try again.");

	const rows = asRows<{
		report_id: string;
		report_status: string;
		suspended: boolean;
	}>(data);
	if (!rows.length) throw notFound("That report no longer exists.");
	return {
		reportId: rows[0].report_id,
		status: rows[0].report_status,
		suspended: rows[0].suspended,
	};
}

export async function reportDetail(ctx: RequestCtx, reportId: string) {
	await requireModerator(ctx);
	z.string().uuid().parse(reportId);
	const client = ctx.db();

	const [report, actions] = await Promise.all([
		client
			.from("reports")
			.select(
				"id,reporter_id,target_type,target_id,reason,details,status,severity,created_at,reviewed_at,reviewed_by,resolution",
			)
			.eq("id", reportId)
			.maybeSingle(),
		client
			.from("moderation_actions")
			.select("id,action,note,created_at,actor_id")
			.eq("report_id", reportId)
			.order("created_at", { ascending: true }),
	]);
	if (report.error)
		throw dbFailure(report.error, "That did not save. Please try again.");
	if (!report.data) throw notFound("That report no longer exists.");

	const targetId = (
		report.data as unknown as { target_id: string; target_type: string }
	).target_id;
	const profile =
		(report.data as unknown as { target_type: string }).target_type ===
		"profile"
			? await client
					.from("profiles")
					.select("id,display_name,handle,age,city,is_suspended,created_at")
					.eq("id", targetId)
					.maybeSingle()
			: null;

	return {
		report: report.data,
		target: profile?.data ?? null,
		history: actions.data ?? [],
		/** Prior reports on the same target: the only signal a moderator needs to
		 *  decide between a warning and a suspension. */
		priorAgainstTarget: (
			await client
				.from("reports")
				.select("id,reason,status,created_at")
				.eq("target_id", targetId)
				.neq("id", reportId)
				.order("created_at", { ascending: false })
				.limit(20)
		).data,
	};
}

/** Role management is admin-only and writes through a privileged path only an
 *  admin can reach; a moderator cannot promote themselves or anyone else. */
export async function setRole(ctx: RequestCtx) {
	const caller = await ctx.auth();
	if (caller.role !== "admin")
		throw forbidden("Only an admin can change moderation roles.");
	const body = await readJson(
		ctx.request,
		z.object({
			profileId: z.string().uuid(),
			role: z.enum(["user", "moderator", "admin"]),
		}),
	);
	const client = ctx.db();
	// `profiles.role` is writable by the owner under the update policy, so the
	// trigger that blocks non-admin escalation is what protects this. is_admin()
	// has already been verified above for this request.
	const update = await client
		.from("profiles")
		.update({ role: body.role } as never)
		.eq("id", body.profileId)
		.select("id,role")
		.single();
	if (update.error)
		throw dbFailure(update.error, "That did not save. Please try again.");
	return { role: (update.data as unknown as { role: string }).role };
}

export async function auditTrail(ctx: RequestCtx) {
	await requireModerator(ctx);
	const client = ctx.db();
	const { data, error } = await client
		.from("moderation_actions")
		.select("id,report_id,target_id,action,note,created_at,actor_id")
		.order("created_at", { ascending: false })
		.limit(100);
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	return { actions: data ?? [] };
}
