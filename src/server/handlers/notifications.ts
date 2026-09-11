/**
 * Notifications. Read from the `notifications` table that server-side triggers
 * write (a match creates two rows inside the same transaction as the match).
 *
 * Explicitly not implemented, and not claimed anywhere in the UI: web push,
 * email digests, and "smart" notification batching. There is no VAPID key and no
 * mailer in this deployment, so `/api/push/subscribe` was removed rather than
 * left as a control that silently does nothing.
 */

import { z } from "zod";
import { badRequest, dbFailure } from "../errors";
import { readJson, type RequestCtx } from "../context";

export async function list(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();

	const [items, unread] = await Promise.all([
		client.from("notifications").select("id,kind,title,body,deep_link,read,created_at").eq("user_id", caller.userId).order("created_at", { ascending: false }).limit(50),
		client.from("notifications").select("id").eq("user_id", caller.userId).eq("read", false),
	]);
	if (items.error) throw dbFailure(items.error, "That did not save. Please try again.");

	const rows = (items.data ?? []) as unknown as Record<string, unknown>[];
	return {
		notifications: rows.map((row) => ({
			id: row.id,
			kind: row.kind,
			title: row.title,
			body: row.body ?? null,
			deepLink: row.deep_link ?? null,
			read: Boolean(row.read),
			createdAt: row.created_at,
		})),
		unread: (unread.data ?? []).length,
	};
}

export async function mark(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, z.object({ action: z.enum(["read", "readAll"]), id: z.string().uuid().optional() }));
	const client = ctx.db();

	if (body.action === "read") {
		if (!body.id) throw badRequest("Which notification should be marked read?");
		await client.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", caller.userId);
		return { ok: true };
	}

	await client.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("user_id", caller.userId).eq("read", false);
	return { ok: true };
}
