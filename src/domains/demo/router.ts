import { demoMeProfileId } from './config';
import { demoCascadeV4, demoGetProfiles, demoMyUploadedPhotos, demoSearchProfiles, num } from './mock/grid';
import { demoConversations, demoConversationMessages, demoSentMessage, demoDrawerMedia } from './mock/conversations';
import { demoReceivedTaps, demoViews } from './mock/interest';

type DemoResponse = { status: number; body: unknown };

function ok(body: unknown): DemoResponse {
	return { status: 200, body };
}

export function demoCallMethod(method: string): unknown {
	switch (method) {
		case 'auth_state':
			return demoMeProfileId;
		case 'login':
		case 'login_with_google':
		case 'google_sign_in':
		case 'refresh_token':
			return { profileId: demoMeProfileId, restriction: null };
		case 'rotate_api_params':
			return { 'user-agent': 'demo', 'l-device-info': 'demo' };
		case 'recaptcha_first_party_enabled':
			return false;
		case 'session_health':
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
	const [rawPath = '', queryString = ''] = path.split('?');
	const params = new URLSearchParams(queryString);
	const segments = rawPath.split('/').filter(Boolean);
	const conversationId = segments[3] ?? '';

	if (method === 'GET' && rawPath === '/v4/cascade') {
		return ok(demoCascadeV4(params));
	}
	if (method === 'GET' && rawPath === '/v7/search') {
		return ok({ profiles: demoSearchProfiles(params) });
	}
	if (method === 'GET' && rawPath.startsWith('/v7/profiles/')) {
		const id = Number(segments.at(-1));
		return ok({ profiles: [{ profileId: id, displayName: 'Demo User' }] });
	}
	if (method === 'POST' && rawPath === '/v3/profiles') {
		const ids = (body as { targetProfileIds?: number[] })?.targetProfileIds ?? [];
		return ok({ profiles: demoGetProfiles(ids) });
	}
	if (rawPath === '/v3.1/me/profile/images' && method === 'GET') {
		return ok(demoMyUploadedPhotos());
	}
	if (rawPath === '/v2/taps/received') return ok({ profiles: demoReceivedTaps() });
	if (rawPath === '/v2/taps/add') return ok({ isMutual: false });
	if (rawPath === '/v7/views/list') return ok(demoViews());
	if (method === 'POST' && rawPath === '/v4/inbox') {
		const filters = body as { favoritesOnly?: boolean } | undefined;
		return ok(demoConversations({
			page: num(params.get('page')) ?? 1,
			favoritesOnly: filters?.favoritesOnly ?? false,
		}));
	}
	if (
		method === 'GET' &&
		rawPath.startsWith('/v5/chat/conversation/') &&
		rawPath.endsWith('/message')
	) {
		return ok(demoConversationMessages({
			conversationId,
			pageKey: params.get('pageKey') ?? undefined,
		}));
	}
	if (method === 'POST' && rawPath === '/v4/chat/message/send') {
		return ok(demoSentMessage(body));
	}
	if (method === 'GET' && rawPath.startsWith('/v4/chat/media/drawer/')) {
		return ok(demoDrawerMedia());
	}

	return ok({});
}
