import { requireSupabase } from "@/integrations/supabase/client";

/**
 * Uploading a file from the browser to the `media` bucket.
 *
 * Three screens needed the same eight lines — `#/routes/settings/profile`,
 * `#/components/profile/profile-client` and now the shout, group and verification
 * forms — and each had retyped them, so each had its own idea of the path prefix and
 * none of them checked the file before sending it. This is the one copy.
 *
 * WHAT IT DOES AND DOES NOT DO
 * ----------------------------
 * It puts bytes in Storage and returns a public URL. It does not write any table:
 * `users.photos` and `verification_requests.selfie_url` are written by routes that a
 * browser token cannot reach directly, because a client that could add a photo path to
 * its own row could add somebody else's.
 *
 * The size and type checks run before the upload, since a 400MB file rejected by a
 * route after transfer is a wasted minute for the person holding the phone.
 */

/** 10 MB — the bucket's practical ceiling for a phone photo or short clip. */
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

const ACCEPTED_PREFIXES = ["image/", "video/"];

export interface UploadResult {
	/** Public URL, the form routes store. */
	url: string;
	/** Path inside the bucket, for a later delete. */
	path: string;
}

export class UploadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UploadError";
	}
}

/**
 * Upload one file under `folder` and return its public URL.
 *
 * `folder` is the caller's own prefix — `shouts`, `avatars`, `verification` — and the
 * file is named from the clock rather than its original name, so two people uploading
 * `IMG_0001.jpg` do not collide and a filename cannot carry a path through the key.
 */
export async function uploadMedia(
	file: File,
	folder: string,
): Promise<UploadResult> {
	if (!file.size) throw new UploadError("That file is empty.");
	if (file.size > MAX_MEDIA_BYTES)
		throw new UploadError(
			`That is ${Math.round(file.size / (1024 * 1024))}MB; the limit is ${
				MAX_MEDIA_BYTES / (1024 * 1024)
			}MB.`,
		);
	if (!ACCEPTED_PREFIXES.some((prefix) => file.type.startsWith(prefix)))
		throw new UploadError("Send a photo or a video, not that file type.");

	const prefix = folder.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "media";
	const ext = (file.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8);
	const path = `${prefix}/${Date.now()}.${ext || "bin"}`;

	const supabase = requireSupabase();
	const { error } = await supabase.storage
		.from("media")
		.upload(path, file, { contentType: file.type, upsert: false });
	if (error) throw new UploadError(error.message);

	const { data } = supabase.storage.from("media").getPublicUrl(path);
	if (!data?.publicUrl)
		throw new UploadError("The upload finished but returned no URL.");
	return { url: data.publicUrl, path };
}

/** The sentence to show when an upload is refused. */
export function uploadMessage(error: unknown): string {
	if (error instanceof UploadError) return error.message;
	if (error instanceof Error && error.message) return error.message;
	return "That upload did not go through. Try again.";
}
