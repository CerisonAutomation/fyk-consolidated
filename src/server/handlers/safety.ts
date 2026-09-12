import { asRows } from "../data/typed-rows";
/**
 * Report and block. Both are one-way doors that must behave identically no matter
 * which surface raises them, so there is exactly one implementation.
 *
 * A block is enforced in three places on purpose:
 *   1. RLS (`is_blocked()`) — a blocked pair can never read each other's rows.
 *   2. Discovery/taps/chat handlers — the action is refused with a real reason.
 *   3. This file — the block list itself is only readable by its owner.
 * Reporting never tells the reporter what happened to the other account; the
 * queue outcome is a moderation decision, not a chat weapon.
 */

import { z } from "zod";
import { type RequestCtx, readJson } from "../context";
import { badRequest, conflict, dbFailure, notFound } from "../errors";

export const REPORT_REASONS = [
	"harassment",
	"spam",
	"fake_profile",
	"inappropriate_content",
	"underage",
	"threat",
	"doxxing",
	"other",
] as const;
/** Anything that alleges a minor, a threat, or doxxing goes straight to urgent. */
export const URGENT_REASONS: readonly string[] = [
	"underage",
	"threat",
	"doxxing",
];

export function severityFor(reason: string): "urgent" | "normal" {
	return URGENT_REASONS.includes(reason) ? "urgent" : "normal";
}

export const reportSchema = z.object({
	targetType: z
		.enum(["profile", "message", "board_post", "event", "album"])
		.default("profile"),
	targetId: z.string().uuid(),
	reason: z.enum(REPORT_REASONS),
	details: z.string().trim().max(1000).optional(),
	/** "Are you sure?" is captured as data so the queue can weigh an accidental tap. */
	confirmed: z.boolean().refine((value) => value === true, {
		message: "Confirm the report before sending.",
	}),
});

export async function submitReport(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, reportSchema);
	const client = ctx.db();

	if (body.targetType === "profile" && body.targetId === caller.userId)
		throw badRequest("You cannot report your own profile.");

	const target =
		body.targetType === "profile"
			? await client
					.from("profiles")
					.select("id,is_suspended")
					.eq("id", body.targetId)
					.maybeSingle()
			: null;
	if (target && !target.data) throw notFound("That profile no longer exists.");

	// Rate-limit style guard that actually matters: one open report per target
	// per reason, so a user cannot flood the queue by tapping report repeatedly.
	const open = await client
		.from("reports")
		.select("id")
		.eq("reporter_id", caller.userId)
		.eq("target_id", body.targetId)
		.eq("reason", body.reason)
		.in("status", ["open", "in_review"])
		.limit(1);
	if ((open.data ?? []).length)
		throw conflict(
			"You already reported this for that reason. A moderator is on it.",
		);

	const insert = await client
		.from("reports")
		.insert({
			reporter_id: caller.userId,
			target_type: body.targetType,
			target_id: body.targetId,
			reason: body.reason,
			details: body.details || null,
		})
		.select("id,status,severity,created_at")
		.single();
	if (insert.error)
		throw dbFailure(insert.error, "That did not save. Please try again.");

	return {
		report: insert.data,
		// The UI shows exactly this and nothing about the target's account state.
		message:
			(insert.data as { severity: string }).severity === "urgent"
				? "Sent to a moderator now. If you are in immediate danger, contact local emergency services."
				: "Sent. Moderators review reports in order of urgency.",
	};
}

export async function myReports(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	const { data, error } = await client
		.from("reports")
		.select(
			"id,target_type,target_id,reason,status,severity,created_at,reviewed_at",
		)
		.eq("reporter_id", caller.userId)
		.order("created_at", { ascending: false })
		.limit(50);
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	return {
		reports: asRows<Record<string, unknown>>(data).map((row) => ({
			id: row.id,
			targetType: row.target_type,
			targetId: row.target_id,
			reason: row.reason,
			status: row.status,
			severity: row.severity,
			createdAt: row.created_at,
			reviewedAt: row.reviewed_at ?? null,
			// A resolution note is only shown once it exists; moderators are not
			// obliged to leave one, and inventing a status would be a lie.
			resolved: row.status === "resolved" || row.status === "dismissed",
		})),
	};
}

export async function blockUser(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(
		ctx.request,
		z.object({
			targetId: z.string().uuid(),
			reason: z.enum(["harassment", "spam", "fake", "other"]).optional(),
		}),
	);
	const client = ctx.db();
	void body.reason; // Blocks are unconditional; a reason would invite appeal threads.

	if (body.targetId === caller.userId)
		throw badRequest("You cannot block yourself.");

	const existing = await client
		.from("blocks")
		.select("id")
		.eq("blocker_id", caller.userId)
		.eq("blocked_id", body.targetId)
		.maybeSingle();
	if (existing.data) throw conflict("You already blocked that person.");

	const insert = await client
		.from("blocks")
		.insert({ blocker_id: caller.userId, blocked_id: body.targetId });
	if (insert.error)
		throw dbFailure(insert.error, "That did not save. Please try again.");

	// Blocking also hides the shared thread from this member's inbox. RLS already
	// prevents either side from reading the other's rows, and messaging is refused
	// in the tap/send handlers, so this is a convenience — not the boundary.
	const conversations = await client
		.from("conversation_members")
		.select("conversation_id")
		.eq("profile_id", caller.userId);
	const ids = asRows<{ conversation_id: string }>(conversations.data).map(
		(row) => row.conversation_id,
	);
	if (ids.length) {
		const others = await client
			.from("conversation_members")
			.select("conversation_id,profile_id")
			.in("conversation_id", ids)
			.eq("profile_id", body.targetId);
		const toArchive = asRows<{ conversation_id: string }>(others.data).map(
			(row) => row.conversation_id,
		);
		if (toArchive.length) {
			await client
				.from("conversation_members")
				.update({ archived_at: new Date().toISOString() })
				.in("conversation_id", toArchive)
				.eq("profile_id", caller.userId);
		}
	}

	return { blocked: true };
}

export async function unblockUser(ctx: RequestCtx, targetId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(targetId);
	const client = ctx.db();
	const remove = await client
		.from("blocks")
		.delete()
		.eq("blocker_id", caller.userId)
		.eq("blocked_id", targetId);
	if (remove.error)
		throw dbFailure(remove.error, "That did not save. Please try again.");
	return { blocked: false };
}

export async function blockList(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	const blocks = await client
		.from("blocks")
		.select("blocked_id,created_at")
		.eq("blocker_id", caller.userId)
		.order("created_at", { ascending: false })
		.limit(200);
	if (blocks.error)
		throw dbFailure(blocks.error, "That did not save. Please try again.");
	const ids = asRows<{ blocked_id: string }>(blocks.data).map(
		(row) => row.blocked_id,
	);
	if (!ids.length) return { blocked: [] };
	const profiles = await client
		.from("profiles")
		.select("id,display_name,handle,avatar_url")
		.in("id", ids);
	const map = new Map(
		asRows<{
			id: string;
			display_name: string | null;
			handle: string | null;
			avatar_url: string | null;
		}>(profiles.data).map((row) => [row.id, row]),
	);
	return {
		blocked: ids.map((id) => ({
			id,
			displayName:
				map.get(id)?.display_name ?? map.get(id)?.handle ?? "Blocked member",
			avatarUrl: map.get(id)?.avatar_url ?? null,
			// Whether they still have an account is deliberately not exposed: it is
			// their private data, and a blocked person has no claim to it.
		})),
	};
}

/** Profile views. The database decides whether a view is recordable at all. */
export async function whoViewedMe(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	const { data, error } = await client
		.from("footprints")
		.select("visitor_id,viewed_at")
		.eq("visited_id", caller.userId)
		.order("viewed_at", { ascending: false })
		.limit(60);
	if (error) throw dbFailure(error, "We could not load that list.");
	const visits = asRows<{ visitor_id: string; viewed_at: string }>(data);
	if (!visits.length) return { views: [] };

	const profiles = await client
		.from("profiles")
		.select("id,display_name,handle,avatar_url,age")
		.in("id", [...new Set(visits.map((visit) => visit.visitor_id))]);
	if (profiles.error)
		throw dbFailure(profiles.error, "We could not load that list.");
	type Viewer = {
		id: string;
		display_name: string | null;
		handle: string | null;
		avatar_url: string | null;
		age: number | null;
	};
	const byId = new Map(
		asRows<Viewer>(profiles.data).map((row) => [row.id, row]),
	);

	return {
		// A visit from a member whose account is gone is dropped rather than shown
		// as "Deleted member", which would imply we know who it was.
		views: visits
			.map((visit) => {
				const profile = byId.get(visit.visitor_id);
				if (!profile) return null;
				return {
					profileId: profile.id,
					displayName: profile.display_name ?? profile.handle ?? "Someone",
					avatarUrl: profile.avatar_url,
					age: profile.age,
					viewedAt: visit.viewed_at,
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
	};
}
