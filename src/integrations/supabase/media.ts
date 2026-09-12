/**
 * One place that turns a stored photo reference into something an `<img>` can
 * load.
 *
 * `users.photos`/`profiles.photos` hold whatever the uploader had: a public URL
 * (the profile editor stores `getPublicUrl()` results) or a bare path inside the
 * `media` bucket (chat, albums, and every row written before the editor existed).
 * Before this helper, four screens — the grid cards, the profile carousel, the
 * "who viewed me" grid and the `UserAvatar` molecule — ran the value through
 * `demoMediaUrl()`, which hashes any string into one of ~20 Unsplash photos. So a
 * real user's real upload was replaced by a stock image of someone else, on every
 * surface, and the only way to see your own photo was to not have one.
 *
 * Demo mode still gets the mock catalogue: that is what `#/domains/demo` is for.
 * Everything else resolves against Storage, and an empty reference stays empty
 * rather than becoming a placeholder face.
 */
import { demoMediaUrl } from "#/domains/demo";
import { demoEnabled } from "#/domains/demo/config";
import { getSupabase } from "./client";

/**
 * The bucket profile photo and gallery uploads live in.
 *
 * It existed only in this constant until `0019_server_owned_economy.sql` §10a
 * created it with `fyk_media_*` policies: `supabase.storage.from("media").upload()`
 * was answering "Bucket not found" for every upload, while `getPublicUrl()` below
 * happily produced a URL to the same non-existent bucket. Chat and album media are
 * *not* here — `chat-media-private` and `albums-private` (0003) own those, and
 * their rows store a bucket-qualified path.
 */
export const MEDIA_BUCKET = "media";

const ABSOLUTE = /^(https?:|blob:|data:)/i;

export function resolveMediaUrl(
	value: string | null | undefined,
): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (ABSOLUTE.test(trimmed)) return trimmed;

	// Demo data has no bucket behind it, and its hashes are deliberately not
	// paths; keep the mock catalogue for that mode only.
	if (demoEnabled) return demoMediaUrl(trimmed);

	const client = getSupabase();
	if (!client) return null;
	return (
		client.storage.from(MEDIA_BUCKET).getPublicUrl(trimmed).data.publicUrl ??
		null
	);
}
