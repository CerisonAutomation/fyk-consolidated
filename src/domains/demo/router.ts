import { demoMeProfileId } from "./config";
import {
	demoConversationMessages,
	demoConversations,
	demoDrawerMedia,
	demoSentMessage,
} from "./mock/conversations";
import {
	demoCascadeV4,
	demoFavoriteOf,
	demoGetProfiles,
	demoMyUploadedPhotos,
	demoSearchProfiles,
	num,
	setDemoFavorite,
} from "./mock/grid";
import { demoReceivedTaps, demoViews } from "./mock/interest";
import {
	lastOnlineOf,
	mediasOf,
	onlineUntilOf,
	profileSeed,
} from "./mock/profiles";

export type DemoResponse = { status: number; body: unknown };

const hiddenProfileIds = new Set<number>();
const blockedProfileIds = new Set<number>();
const favoriteNotes = new Map<number, { notes: string; phoneNumber: string }>();
let accountPreferences: Record<string, unknown> = {
	showDistance: true,
	showProfileViews: true,
};

function ok(body: unknown): DemoResponse {
	return { status: 200, body };
}

function demoProfile(profileId: number): Record<string, unknown> {
	const seed = profileSeed(profileId);
	return {
		profileId,
		displayName: seed.name,
		age: seed.age,
		showAge: seed.showAge,
		distance: seed.distanceM,
		aboutMe: seed.bio,
		bodyType: seed.body,
		sexualPosition: seed.position,
		hivStatus: seed.hiv,
		height: seed.heightCm,
		weight: seed.weightG ? Math.round(seed.weightG / 1000) : null,
		grindrTribes: seed.tribes,
		lookingFor: seed.lookingFor,
		medias: mediasOf(seed),
		onlineUntil: onlineUntilOf(seed),
		lastOnline: lastOnlineOf(seed),
		isFavorite: demoFavoriteOf({ profileId }),
		isVerified: profileId % 7 === 0,
		socialNetworks: seed.instagram ? { instagram: seed.instagram } : {},
	};
}

export function demoCallMethod(method: string): unknown {
	switch (method) {
		case "auth_state":
			return demoMeProfileId;
		case "login":
		case "login_with_google":
		case "google_sign_in":
		case "refresh_token":
			return { profileId: demoMeProfileId, restriction: null };
		case "rotate_api_params":
			return { "user-agent": "demo", "l-device-info": "demo" };
		case "recaptcha_first_party_enabled":
			return false;
		case "session_health":
			return { signedIn: true, expiresAt: null, stale: false };
		default:
			return null;
	}
}

export function demoRoute({
	path,
	method,
	body,
}: {
	path: string;
	method: string;
	body: unknown;
}): DemoResponse {
	const [rawPath = "", queryString = ""] = path.split("?");
	const params = new URLSearchParams(queryString);
	const segments = rawPath.split("/").filter(Boolean);
	const conversationId = segments[3] ?? "";

	if (method === "GET" && rawPath === "/v4/cascade") {
		return ok(demoCascadeV4(params));
	}
	if (method === "GET" && rawPath === "/v7/search") {
		return ok({ profiles: demoSearchProfiles(params) });
	}
	if (method === "GET" && rawPath.startsWith("/v7/profiles/")) {
		const id = Number(segments.at(-1));
		return ok({ profiles: [demoProfile(id)] });
	}
	if (method === "POST" && rawPath === "/v3/profiles") {
		const ids =
			(body as { targetProfileIds?: number[] })?.targetProfileIds ?? [];
		return ok({ profiles: demoGetProfiles(ids) });
	}
	if (rawPath === "/v3.1/me/profile/images" && method === "GET") {
		return ok(demoMyUploadedPhotos());
	}
	if (rawPath === "/v2/taps/received")
		return ok({ profiles: demoReceivedTaps() });
	if (rawPath === "/v2/taps/add") return ok({ isMutual: false });
	if (rawPath === "/v7/views/list") return ok(demoViews());
	if (method === "POST" && rawPath.startsWith("/v5/views/")) return ok({});
	if (method === "POST" && rawPath === "/v4/inbox") {
		const filters = body as { favoritesOnly?: boolean } | undefined;
		return ok(
			demoConversations({
				page: num(params.get("page")) ?? 1,
				favoritesOnly: filters?.favoritesOnly ?? false,
			}),
		);
	}
	if (
		method === "GET" &&
		rawPath.startsWith("/v5/chat/conversation/") &&
		rawPath.endsWith("/message")
	) {
		return ok(
			demoConversationMessages({
				conversationId,
				pageKey: params.get("pageKey") ?? undefined,
			}),
		);
	}
	if (method === "POST" && rawPath === "/v4/chat/message/send") {
		return ok(demoSentMessage(body));
	}
	if (method === "POST" && rawPath === "/v4/chat/message/reaction")
		return ok({});
	if (method === "POST" && rawPath === "/v4/chat/message/delete") return ok({});
	if (
		method === "POST" &&
		(rawPath.includes("/read/") ||
			rawPath.endsWith("/pin") ||
			rawPath.endsWith("/unpin") ||
			rawPath.endsWith("/mute") ||
			rawPath.endsWith("/unmute"))
	) {
		return ok({});
	}
	if (method === "DELETE" && rawPath.startsWith("/v4/chat/conversation/"))
		return ok({});
	if (method === "GET" && rawPath.startsWith("/v4/chat/media/drawer/")) {
		return ok(demoDrawerMedia());
	}

	const targetId = Number(segments.at(-1));
	if (rawPath.startsWith("/v3/me/favorites/") && Number.isFinite(targetId)) {
		setDemoFavorite(targetId, method === "POST");
		return ok({});
	}
	if (rawPath.startsWith("/v1/favorites/notes/") && Number.isFinite(targetId)) {
		if (method === "GET") {
			return ok(favoriteNotes.get(targetId) ?? { notes: "", phoneNumber: "" });
		}
		if (method === "PUT") {
			const note = body as { notes?: string; phoneNumber?: string };
			favoriteNotes.set(targetId, {
				notes: note.notes ?? "",
				phoneNumber: note.phoneNumber ?? "",
			});
			return ok({});
		}
	}
	if (rawPath === "/v1/hides" && method === "GET") {
		return ok({
			hides: [...hiddenProfileIds].map((profileId) => ({ profileId })),
		});
	}
	if (
		rawPath.startsWith("/v1/me/hides/") &&
		method === "POST" &&
		Number.isFinite(targetId)
	) {
		hiddenProfileIds.add(targetId);
		return ok({});
	}
	if (
		rawPath.startsWith("/v1/hides/") &&
		method === "DELETE" &&
		Number.isFinite(targetId)
	) {
		hiddenProfileIds.delete(targetId);
		return ok({});
	}
	if (rawPath === "/v3.1/me/blocks" && method === "GET") {
		return ok({
			blocking: [...blockedProfileIds].map((profileId) => ({
				profileId,
				blockedTime: Date.now(),
			})),
		});
	}
	if (rawPath.startsWith("/v3/me/blocks/") && Number.isFinite(targetId)) {
		if (method === "POST") blockedProfileIds.add(targetId);
		if (method === "DELETE") blockedProfileIds.delete(targetId);
		return ok({});
	}
	if (rawPath === "/v3/me/prefs/settings") {
		if (method === "GET") return ok(accountPreferences);
		if (method === "PUT") {
			const patch = body as { settings?: Record<string, unknown> };
			accountPreferences = { ...accountPreferences, ...(patch.settings ?? {}) };
			return ok({});
		}
	}
	if (rawPath === "/public/v2/genders") {
		return ok({
			genders: [
				{ id: 1, name: "Man" },
				{ id: 2, name: "Non-binary" },
			],
		});
	}
	if (rawPath === "/v1/pronouns") {
		return ok({
			pronouns: [
				{ id: 1, name: "he/him" },
				{ id: 2, name: "they/them" },
			],
		});
	}
	if (rawPath === "/v1/tags") {
		return ok({
			tags: ["Dates", "Friends", "Chat", "Right Now"].map((name, id) => ({
				id,
				name,
			})),
		});
	}
	if (rawPath === "/v1/albums" && method === "GET") return ok({ albums: [] });
	if (rawPath.startsWith("/v2/albums/") && method === "GET")
		return ok({ content: [] });
	if (rawPath.startsWith("/v3/places/search")) return ok({ places: [] });
	if (rawPath === "/v4/me/profile" && method === "PATCH") return ok({});
	if (rawPath === "/v3.1/me/profile" && method === "PUT") return ok({});
	if (rawPath === "/api/auth/state") return ok(demoMeProfileId);
	if (rawPath === "/api/auth/session-health") {
		return ok({ signedIn: true, expiresAt: null, stale: false });
	}
	if (rawPath === "/api/auth/login") {
		return ok({ profileId: demoMeProfileId, restriction: null });
	}
	if (rawPath === "/api/auth/logout") return ok({});

	return ok({});
}
