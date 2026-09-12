import { asRows } from "../data/typed-rows";
/**
 * Uploads go through the server so the storage path convention (which the bucket
 * policies read as the owner folder) cannot be forged, and so size/MIME limits are
 * enforced somewhere a client cannot edit.
 */

import { z } from "zod";
import { type RequestCtx, readJson } from "../context";
import { type ProfileRow, publicUrl } from "../data/profiles";
import {
	ApiFailure,
	badRequest,
	dbFailure,
	forbidden,
	notFound,
} from "../errors";

const MAX_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CHAT_TYPES = new Set([
	...IMAGE_TYPES,
	"video/mp4",
	"video/webm",
	"audio/webm",
	"audio/mpeg",
	"audio/mp4",
]);

function extensionFor(type: string): string {
	if (type === "image/jpeg") return "jpg";
	if (type === "image/png") return "png";
	if (type === "image/webp") return "webp";
	if (type === "video/mp4") return "mp4";
	if (type === "video/webm") return "webm";
	if (type === "audio/mpeg") return "mp3";
	if (type === "audio/mp4") return "m4a";
	return "bin";
}

/**
 * POST /api/media/photos — multipart upload; replaces the whole photo set.
 * The client sends the files it wants on the profile, in order.
 */
export async function uploadPhotos(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();

	let form: FormData;
	try {
		form = await ctx.request.formData();
	} catch {
		throw badRequest("Send the photos as multipart form data.");
	}

	const files = form
		.getAll("files")
		.filter((entry): entry is File => entry instanceof File);
	if (!files.length) throw badRequest("No photos were included.");
	if (files.length > 9) throw badRequest("Up to 9 photos per profile.");

	const uploaded: string[] = [];
	try {
		for (const [index, file] of files.entries()) {
			if (!IMAGE_TYPES.has(file.type))
				throw badRequest(
					`Only JPEG, PNG or WebP photos are supported (got ${file.type || "unknown type"}).`,
				);
			if (file.size > MAX_BYTES)
				throw badRequest(
					`Each photo must be under ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
				);

			const path = `${caller.userId}/${Date.now()}-${index}.${extensionFor(file.type)}`;
			const upload = await client.storage
				.from("photos-public")
				.upload(path, file, {
					contentType: file.type,
					cacheControl: "31536000",
					upsert: false,
				});
			if (upload.error)
				throw dbFailure(upload.error, "That did not save. Please try again.");
			uploaded.push(path);
		}
	} catch (error) {
		// Never leave orphaned objects behind when a later photo fails.
		if (uploaded.length)
			await client.storage.from("photos-public").remove(uploaded);
		throw error;
	}

	await client.from("profile_photos").delete().eq("owner_id", caller.userId);
	const rows = uploaded.map((path, index) => ({
		owner_id: caller.userId,
		storage_path: path,
		bucket: "photos-public",
		position: index,
		is_primary: index === 0,
	}));
	const insert = await client
		.from("profile_photos")
		.insert(rows)
		.select("id,storage_path,bucket,position,is_primary");
	if (insert.error)
		throw dbFailure(insert.error, "That did not save. Please try again.");

	await client
		.from("profiles")
		.update({
			avatar_url: publicUrl(client, "photos-public", uploaded[0]),
			last_active_at: new Date().toISOString(),
		})
		.eq("id", caller.userId);

	return {
		photos: asRows<{ storage_path: string; bucket: string }>(insert.data).map(
			(row) => ({
				url: publicUrl(client, row.bucket, row.storage_path),
			}),
		),
	};
}

/** POST /api/media/avatar */
export async function uploadAvatar(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	let form: FormData;
	try {
		form = await ctx.request.formData();
	} catch {
		throw badRequest("Send the image as multipart form data.");
	}
	const file = form.get("file");
	if (!(file instanceof File)) throw badRequest("No file was included.");
	if (!IMAGE_TYPES.has(file.type))
		throw badRequest("Use a JPEG, PNG or WebP image.");
	if (file.size > MAX_BYTES) throw badRequest("The image must be under 12 MB.");

	const path = `${caller.userId}/avatar-${Date.now()}.${extensionFor(file.type)}`;
	const upload = await client.storage
		.from("avatars-public")
		.upload(path, file, {
			contentType: file.type,
			cacheControl: "31536000",
			upsert: true,
		});
	if (upload.error)
		throw dbFailure(upload.error, "That did not save. Please try again.");

	const update = await client
		.from("profiles")
		.update({ avatar_url: publicUrl(client, "avatars-public", path) })
		.eq("id", caller.userId)
		.select("id,avatar_url")
		.single();
	if (update.error)
		throw dbFailure(update.error, "That did not save. Please try again.");
	return {
		avatarUrl: (update.data as unknown as { avatar_url: string }).avatar_url,
	};
}

export async function touchPresence(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	const { error } = await client
		.from("profiles")
		.update({ last_active_at: new Date().toISOString() })
		.eq("id", caller.userId);
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	const me = await client
		.from("profiles")
		.select("id,last_active_at,open_to_meet,available_until")
		.eq("id", caller.userId)
		.maybeSingle();
	return {
		at: new Date().toISOString(),
		state: (me.data ?? null) as unknown as Pick<
			ProfileRow,
			"last_active_at"
		> | null,
	};
}

/**
 * POST /api/media/chat — one image or short video for a conversation.
 *
 * Chat media is private: the object lands in `chat-media-private/<userId>/…` and
 * is only ever handed to the browser as a short-lived signed URL (see
 * `listMessages`). There is no public read path for this bucket, so a leaked
 * message body cannot leak the file.
 */
export async function uploadChatMedia(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();

	let form: FormData;
	try {
		form = await ctx.request.formData();
	} catch {
		throw badRequest("Send the file as multipart form data.");
	}

	const file = form.get("file");
	if (!(file instanceof File)) throw badRequest("No file was included.");
	const conversationId = String(form.get("conversationId") ?? "");
	if (!/^[0-9a-f-]{36}$/i.test(conversationId))
		throw badRequest("Which conversation is this for?");

	const type = file.type || "application/octet-stream";
	if (!CHAT_TYPES.has(type))
		throw new ApiFailure(
			"unsupported_media",
			"FYK chat accepts JPEG, PNG, WebP, MP4, WebM or M4A files.",
		);
	const limit = type.startsWith("video/") ? 32 * 1024 * 1024 : 12 * 1024 * 1024;
	if (file.size > limit)
		throw new ApiFailure(
			"payload_too_large",
			type.startsWith("video/")
				? "Videos must be under 32 MB."
				: "Images must be under 12 MB.",
		);

	// Membership is checked before a byte is stored, so a non-member cannot use the
	// upload endpoint to fill the bucket.
	const member = await client
		.from("conversation_members")
		.select("conversation_id")
		.eq("conversation_id", conversationId)
		.eq("profile_id", caller.userId)
		.maybeSingle();
	if (!member.data) throw forbidden("You are not part of that conversation.");

	const path = `${caller.userId}/${crypto.randomUUID()}.${extensionFor(type)}`;
	const upload = await client.storage
		.from("chat-media-private")
		.upload(path, file, {
			contentType: type,
			cacheControl: "3600",
			upsert: false,
		});
	if (upload.error)
		throw dbFailure(upload.error, "That upload failed. Try again.");

	const { data: signed } = await client.storage
		.from("chat-media-private")
		.createSignedUrl(path, 600);

	return {
		storagePath: path,
		kind: type.startsWith("video/")
			? "video"
			: type.startsWith("audio/")
				? "audio"
				: "image",
		// Preview only: the durable reference is the path, and every later read
		// re-signs it. A URL is never persisted.
		previewUrl: signed?.signedUrl ?? null,
	};
}

/**
 * GET /api/media/photos and the delete route exist so photo management is real:
 * the client is handed its own rows (id + public URL) and can remove any subset.
 * Without this the only "management" a profile could offer is replace-all, which
 * is how apps end up with a photo grid nobody can fix.
 */
export async function listMyPhotos(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	const { data, error } = await client
		.from("profile_photos")
		.select(
			"id,storage_path,bucket,position,is_primary,width,height,created_at",
		)
		.eq("owner_id", caller.userId)
		.order("position", { ascending: true });
	if (error) throw dbFailure(error, "We could not load your photos.");
	const rows = asRows<{
		id: string;
		storage_path: string;
		bucket: string | null;
		position: number;
		is_primary: boolean;
		width: number | null;
		height: number | null;
		created_at: string;
	}>(data);
	return {
		photos: rows.map((row) => ({
			id: row.id,
			url: publicUrl(client, row.bucket ?? "photos-public", row.storage_path),
			position: row.position,
			isPrimary: row.is_primary,
			width: row.width,
			height: row.height,
			createdAt: row.created_at,
		})),
	};
}

/** POST /api/media/photos/delete — remove the caller's own photos by id. */
export async function deletePhotos(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(
		ctx.request,
		z.object({ ids: z.array(z.string().uuid()).min(1).max(9) }),
	);
	const client = ctx.db();

	// Owner-scoped read first: an id that is not yours is reported as missing
	// rather than as "forbidden", so the endpoint cannot be used to probe ids.
	const existing = await client
		.from("profile_photos")
		.select("id,storage_path,bucket,is_primary")
		.eq("owner_id", caller.userId)
		.in("id", body.ids);
	if (existing.error)
		throw dbFailure(existing.error, "That did not save. Please try again.");
	const rows = asRows<{
		id: string;
		storage_path: string;
		bucket: string | null;
		is_primary: boolean;
	}>(existing.data);
	if (!rows.length) throw notFound("None of those photos are on your profile.");

	const remove = await client
		.from("profile_photos")
		.delete()
		.eq("owner_id", caller.userId)
		.in(
			"id",
			rows.map((row) => row.id),
		);
	if (remove.error)
		throw dbFailure(remove.error, "That did not save. Please try again.");

	// Objects are deleted after the rows: an orphaned object is a storage leak, a
	// row pointing at a deleted object is a broken image in front of users.
	const byBucket = new Map<string, string[]>();
	for (const row of rows) {
		const bucket = row.bucket ?? "photos-public";
		byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), row.storage_path]);
	}
	for (const [bucket, paths] of byBucket) {
		await client.storage.from(bucket as "photos-public").remove(paths);
	}

	const remaining = await client
		.from("profile_photos")
		.select("id,storage_path,bucket,position")
		.eq("owner_id", caller.userId)
		.order("position", { ascending: true })
		.limit(1);
	const primary = (remaining.data ?? [])[0] as
		| { storage_path: string; bucket: string | null }
		| undefined;
	await client
		.from("profiles")
		.update({
			avatar_url: primary
				? publicUrl(
						client,
						primary.bucket ?? "photos-public",
						primary.storage_path,
					)
				: null,
			last_active_at: new Date().toISOString(),
		})
		.eq("id", caller.userId);

	return { removed: rows.length, remaining: (remaining.data ?? []).length };
}
