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
 * `discover-client.tsx` and `profile/user-profile-client.tsx` both post here and
 * read `{ isMatch }`; the route did not exist, so every tap was a `404` that the
 * optimistic UI still painted as "Tap sent" — the tap was never recorded and no
 * match could ever happen from it. The decision logic lives in
 * `#/lib/tap.server` so `/api/discover` and this endpoint cannot disagree.
 *
 * `DELETE /api/taps?targetId=` (also `POST { action: "unswipe" }`, which the chat
 * sheet can call) removes a tap *before* it became a match — a real undo, not a
 * client-side state reset.
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
