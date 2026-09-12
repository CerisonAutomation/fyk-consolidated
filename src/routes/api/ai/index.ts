import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "#/db";
import {
	analyzeChatHealth,
	analyzeProfile,
	detectIntent,
	generateBio,
	generateIcebreakers,
	planDate,
	predictChurn,
	rankPhotos,
	suggestReplies,
	summarizeChat,
} from "#/domains/ai/heuristic";
import {
	asStringArray,
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, messages, users } from "#/schema";

/**
 * `POST /api/ai` — the assistant actions the UI already calls.
 *
 * Seven components call `/api/ai` (deck modal, chat, inbox digest, onboarding,
 * profile, events); the endpoint did not exist, so every one of those buttons
 * failed with a `404` that surfaced as a generic "something went wrong" toast.
 *
 * Everything here runs the **local heuristic engine** in
 * `#/domains/ai/heuristic` — no provider key, no per-request bill, no prompt
 * injection surface, and it works offline. That is a deliberate first step
 * rather than a placeholder: each heuristic is deterministic and unit-testable,
 * and swapping in `@tanstack/ai` later changes only this file's dispatch table.
 *
 * Privacy rules this route must keep:
 *   - `icebreakers` / `profileAnalysis` read the *target's* row but return only
 *     generated copy, never their raw profile fields, email, phone or location.
 *   - `chatHealth` / `summary` verify **membership** in `conversation_members`
 *     before reading a single message, and skip `unsent_at` (recalled) rows.
 *   - Nothing is persisted: no AI call writes a row, so a user's messages are
 *     not copied into a second store the privacy policy has to describe.
 */
const MAX_MESSAGES = 200;

const requestSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("bioWriter"),
		city: z.string().max(120).optional(),
		occupation: z.string().max(120).optional(),
		aboutMe: z.string().max(2000).optional(),
		age: z.coerce.number().int().min(18).max(120).optional(),
		interests: z.array(z.string().max(60)).max(40).optional(),
		lookingFor: z.array(z.number().int()).max(20).optional(),
		grindrTribes: z.array(z.number().int()).max(20).optional(),
		// `pseudo`/`tribes`/`looking_for` are the names the onboarding and
		// profile forms send (they mirror the `users` columns), so both
		// spellings are accepted rather than silently dropping the input.
		pseudo: z.string().max(64).optional(),
		looking_for: z.array(z.number().int()).max(20).optional(),
		tribes: z.array(z.number().int()).max(20).optional(),
	}),
	z.object({ action: z.literal("icebreakers"), targetId: z.uuid() }),
	z.object({ action: z.literal("profileAnalysis"), targetId: z.uuid() }),
	z.object({
		action: z.literal("datePlanner"),
		interests: z.array(z.string().max(60)).max(30).default([]),
		budget: z.enum(["free", "low", "mid", "high"]).default("low"),
	}),
	z.object({
		action: z.literal("photoRanker"),
		photos: z.array(z.string().url().max(2048)).min(1).max(12),
	}),
	z.object({ action: z.literal("replies"), message: z.string().max(2000) }),
	z.object({ action: z.literal("chatHealth"), conversationId: z.uuid() }),
	z.object({ action: z.literal("summary"), conversationId: z.uuid() }),
]);

export const Route = createFileRoute("/api/ai/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			GET: methodNotAllowed("POST"),
			PUT: methodNotAllowed("POST"),
			PATCH: methodNotAllowed("POST"),
			DELETE: methodNotAllowed("POST"),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, requestSchema, 32 * 1024);

					switch (body.action) {
						case "bioWriter": {
							const options = generateBio({
								city: body.city ?? null,
								occupation: body.occupation ?? null,
								aboutMe: body.aboutMe,
								age: body.age ?? null,
								interests: body.interests,
								lookingFor: body.lookingFor ?? body.looking_for,
								grindrTribes: body.grindrTribes ?? body.tribes,
							});
							return json({ options });
						}

						case "icebreakers": {
							const target = await loadPublicProfile(body.targetId);
							if (!target) return jsonError("Profile not found", 404);
							return json({
								icebreakers: generateIcebreakers({
									displayName: target.displayName,
									interests: asStringArray(target.interests),
									aboutMe: target.bio ?? undefined,
								}),
							});
						}

						case "profileAnalysis": {
							const target = await loadPublicProfile(body.targetId);
							if (!target) return jsonError("Profile not found", 404);
							// `analyzeProfile` scores completeness; it takes the same
							// shape the caller's own profile has, and nothing personal
							// about the target is echoed back.
							// `analyzeProfile` scores the completeness signals it can
							// see; photo count comes from `medias`, which this table
							// does not have, so the photo dimension of the score is
							// deliberately left at "no photos" rather than guessed.
							const analysis = analyzeProfile({
								displayName: target.displayName ?? null,
								aboutMe: target.bio ?? null,
								interests: asStringArray(target.interests),
								age: target.age ?? null,
							});
							return json(analysis);
						}

						case "datePlanner": {
							const plans = planDate(body.interests, body.budget);
							const list = Array.isArray(plans) ? plans : [plans];
							return json({
								ideas: list.map((plan) =>
									[plan.idea, plan.interestAddition ?? ""].filter(Boolean),
								),
							});
						}

						case "photoRanker":
							// `ranked`, not `photos`: that is the key
							// `#/components/profile/profile-client.tsx` reads.
							return json({ ranked: rankPhotos(body.photos) });

						case "replies": {
							// Classify, then reply from the matching template set. The
							// label and confidence are returned so the UI can show why
							// a suggestion looks the way it does instead of pretending
							// the machine knew more than it did.
							const detected = detectIntent(body.message);
							return json({
								replies: suggestReplies(body.message, detected.intent),
								intent: {
									label: detected.intent,
									confidence: detected.confidence,
								},
							});
						}

						case "chatHealth": {
							const thread = await loadConversation(
								user.id,
								body.conversationId,
							);
							if (!thread) return jsonError("Conversation not found", 404);
							const mapped = thread.messages.map((row) => ({
								senderId: hashActor(row.senderId, user.id),
								text: row.body ?? "",
								timestamp: row.createdAt?.getTime() ?? Date.now(),
							}));
							const health = analyzeChatHealth(mapped);
							const lastActive = mapped.at(-1)?.timestamp ?? 0;
							const churn = predictChurn(
								mapped.map((row) => ({
									senderId: row.senderId,
									timestamp: row.timestamp,
								})),
								lastActive,
							);
							return json({
								health: health.score,
								trend: health.trend,
								flags: health.flags,
								suggestions: health.suggestions,
								churn,
								otherName: thread.otherName,
							});
						}

						case "summary": {
							const thread = await loadConversation(
								user.id,
								body.conversationId,
							);
							if (!thread) return jsonError("Conversation not found", 404);
							const summary = summarizeChat(
								thread.messages.map((row) => ({
									text: row.body ?? "",
									timestamp: row.createdAt?.getTime() ?? Date.now(),
								})),
							);
							return json({
								bullets: summary.topics,
								actionItems: summary.actionItems,
								messageCount: summary.messageCount,
							});
						}

						default:
							return jsonError("Unknown action", 400);
					}
				},
				{
					maxBodySize: 32 * 1024,
					// Heuristics are cheap, but they are not free: this is the only
					// endpoint where a client can ask the server to think.
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `ai:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});

/** Only the columns a generated line needs — never contact data. */
async function loadPublicProfile(id: string) {
	const [row] = await db
		.select({
			id: users.id,
			displayName: users.displayName,
			bio: users.bio,
			interests: users.interests,
			photos: users.photos,
			age: users.age,
			isSuspended: users.isSuspended,
		})
		.from(users)
		.where(eq(users.id, id))
		.limit(1);
	return row && !row.isSuspended ? row : null;
}

/**
 * Membership check + the last messages of a thread, newest last.
 *
 * `conversation_members.profile_id = caller` is the only way a conversation is
 * reachable; the id alone is never trusted, so guessing a uuid cannot read
 * someone else's chat.
 */
async function loadConversation(callerId: string, conversationId: string) {
	const [member] = await db
		.select({ conversationId: conversationMembers.conversationId })
		.from(conversationMembers)
		.where(
			and(
				eq(conversationMembers.conversationId, conversationId),
				eq(conversationMembers.profileId, callerId),
			),
		)
		.limit(1);
	if (!member) return null;

	// The other participant's name: the AI panel greets with it, and it is the
	// only identity datum this action returns.
	const [peer] = await db
		.select({
			displayName: users.displayName,
			handle: users.handle,
		})
		.from(conversationMembers)
		.leftJoin(users, eq(users.id, conversationMembers.profileId))
		.where(
			and(
				eq(conversationMembers.conversationId, conversationId),
				sql`${conversationMembers.profileId} <> ${callerId}`,
			),
		)
		.limit(1);

	const rows = await db
		.select({
			senderId: messages.senderId,
			body: messages.body,
			createdAt: messages.createdAt,
		})
		.from(messages)
		.where(
			and(
				eq(messages.conversationId, conversationId),
				isNull(messages.unsentAt),
			),
		)
		.orderBy(asc(messages.createdAt))
		.limit(MAX_MESSAGES);
	return {
		messages: rows.reverse(),
		otherName: peer?.displayName ?? peer?.handle ?? "Them",
	};
}

/**
 * The heuristic wants numeric speaker ids; the database has uuids. Two actors
 * only, so this maps to 0/1 by "is this the caller" instead of leaking uuid
 * fragments into the analysis output.
 */
function hashActor(senderId: string, callerId: string): number {
	return senderId === callerId ? 0 : 1;
}
