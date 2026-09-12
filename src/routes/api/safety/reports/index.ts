import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { db } from "#/db";
import { cleanText, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";

/**
 * `POST|GET /api/safety/reports` — the report button on a profile and in a chat.
 *
 * Two screens submit reports; neither could, because the endpoint did not exist
 * and the failure was swallowed by a `catch` that showed a success toast anyway.
 * That combination is worse than a crash: the user believes moderation has the
 * report and it has nothing.
 *
 * `public.reports` is the moderation queue table from `0000_profiles.sql`
 * (`target_type`, `target_id`, `reason`, `details`, `status report_status default
 * 'open'`, plus `char_length(details) <= 1000`). The API writes it with the same
 * shape so the existing moderation tooling and RLS keep working.
 *
 * Guarded here: no self-reports, the target must exist, and one open report per
 * (reporter, target, reason) — a duplicate would bury the queue, so a repeat is
 * folded into the existing row's `details` instead of inserted.
 */
const reportSchema = z.object({
	reportedId: z.uuid(),
	targetId: z.uuid().optional(),
	reason: z.string().trim().min(3, "Pick a reason").max(80),
	details: z.string().max(1000).optional(),
	targetType: z
		.enum(["profile", "message", "event", "board", "album"])
		.default("profile"),
});

export const Route = createFileRoute("/api/safety/reports/")({
	server: {
		handlers: {
			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, reportSchema, 8 * 1024);
					const targetId = body.targetId ?? body.reportedId;
					if (targetId === user.id)
						return jsonError("You cannot report your own profile", 400);

					const [target] = await db
						.select({ id: users.id })
						.from(users)
						.where(eq(users.id, targetId))
						.limit(1);
					if (!target) return jsonError("That profile no longer exists", 404);

					const details = cleanText(body.details ?? "", 1000) || null;
					const reason = cleanText(body.reason, 80);

					const [existing] = await db.execute(sql`
							select id from public.reports
							 where reporter_id = ${user.id}
							   and target_id = ${targetId}
							   and target_type = ${body.targetType}
							   and reason = ${reason}
							   and status = 'open'
							 order by created_at desc
							 limit 1
						`);

					if (existing && details) {
						await db.execute(sql`
							update public.reports
							   set details = left(
								     coalesce(details, '') || E'\n—\n' || ${details},
								     1000
								   )
							 where id = ${String((existing as { id: string }).id)}
						`);
						return json({
							ok: true,
							id: (existing as { id: string }).id,
							merged: true,
						});
					}
					if (existing)
						return json({
							ok: true,
							id: (existing as { id: string }).id,
							merged: true,
						});

					const [row] = (await db.execute(sql`
						insert into public.reports
							(reporter_id, target_type, target_id, reason, details, status)
						values
							(${user.id}, ${body.targetType}, ${targetId}, ${reason}, ${details}, 'open')
						returning id, created_at
					`)) as unknown as [{ id: string; created_at: Date }];

					return json(
						{
							ok: true,
							id: row.id,
							createdAt: new Date(row.created_at).toISOString(),
						},
						{ status: 201 },
					);
				},
				{
					maxBodySize: 8 * 1024,
					// Report spam is the abuse this endpoint has to survive; 5 per 15 min
					// per account is enough for a real incident and nothing more.
					rateLimit: {
						limit: 5,
						windowMs: 15 * 60 * 1000,
						key: ({ caller }) => `reports:${caller?.id ?? "anon"}`,
					},
				},
			),

			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					const rows = await db.execute(sql`
						select id, target_type as "targetType", target_id as "targetId",
						       reason, status, created_at as "createdAt"
						  from public.reports
						 where reporter_id = ${user.id}
						 order by created_at desc
						 limit 50
					`);
					return json(
						{ reports: rows as unknown[], count: (rows as unknown[]).length },
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `reports:GET:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
