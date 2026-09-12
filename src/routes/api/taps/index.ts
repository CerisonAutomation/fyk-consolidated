import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { readJson, requireCaller, z } from "#/lib/api-helpers";
import { recordTap } from "#/lib/tap.server";
import { json, jsonError, withSecurity } from "#/middleware";
import { taps } from "#/schema";

/**
 * `POST /api/taps` — the tap itself.
 *
 * Two screens reach this: `/interest/taps` (the deck) and a user's profile card,
 * and both go through `#/integrations/supabase/interest.ts`, which prefers
 * `/api/interest/like` — the same engine, reached by the name the design system
 * already uses. `DELETE` and `action: "unswipe"` both remove the row; nothing here
 * flips `taps.type` to undo a tap, which is what the removed client-side version
 * did and why an unswiped like could come back as a "hi".
 *
 * The decision logic lives in `#/lib/tap.server`, which `/api/discover` uses too,
 * so a tap and the `myTap` the deck shows are the same row read the same way. The
 * free allowance is enforced there rather than counted by the client that benefits
 * from miscounting it: 50 taps a day for a `free` account, unlimited on `plus` and
 * above (`tapLimitFor`), and a 429 with `retry_after_seconds` once it is spent.
 *
 * Match detection is deliberately on this side of the network: a mutual tap
 * creates the `matches` row and both `match` notifications in one transaction, and
 * a `blocks` row in either direction vetoes it, so a block can never produce a
 * "It's a match!" the other person did not agree to.
 */
const tapSchema = z.object({
	targetId: z.uuid(),
	type: z.enum(["like", "woof"]).default("like"),
	action: z.enum(["tap", "unswipe"]).default("tap"),
});

export const Route = createFileRoute("/api/taps/")({
	server: {
		handlers: {
			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, tapSchema, 4 * 1024);
					if (body.targetId === user.id)
						return jsonError("Cannot tap yourself", 400);

					if (body.action === "unswipe") {
						const removed = await db
							.delete(taps)
							.where(
								and(
									eq(taps.tapperId, user.id),
									eq(taps.tappedId, body.targetId),
								),
							)
							.returning({ id: taps.id });
						return json({
							ok: true,
							undone: removed.length > 0,
							isMatch: false,
							matched: false,
						});
					}

					const outcome = await recordTap({
						userId: user.id,
						targetId: body.targetId,
						kind: body.type,
					});
					if (outcome.status === "quota")
						return jsonError(
							`${outcome.limit} taps a day on Free — you have used all ${outcome.used}. Upgrade for unlimited taps.`,
							429,
						);
					if (outcome.status === "not_found")
						return jsonError("Profile not found", 404);
					if (outcome.status === "blocked")
						return jsonError("This profile is not available", 403);
					return json(
						{
							ok: true,
							tapped: true,
							firstTap: outcome.firstTap,
							isMatch: outcome.matched,
							matched: outcome.matched,
							type: outcome.kind,
						},
						{ status: 201 },
					);
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 240,
						key: ({ caller }) => `taps:POST:${caller?.id ?? "anon"}`,
					},
				},
			),

			DELETE: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const targetId = new URL(request.url).searchParams.get("targetId");
					if (!targetId) return jsonError("targetId is required", 400);
					const removed = await db
						.delete(taps)
						.where(and(eq(taps.tapperId, user.id), eq(taps.tappedId, targetId)))
						.returning({ id: taps.id });
					return json({ ok: true, undone: removed.length > 0 });
				},
				{
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `taps:DELETE:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
