import { now } from '#/core/lib/clock';
import { getPreferencesSnapshot } from '#/domains/settings/preferences';
import { useGridStore } from '#/domains/grid/store';

export const ONLINE_WINDOW_MS = 10 * 60 * 1000;
const ONLINE_REFRESH_MARGIN_MS = 3 * 60 * 1000;
export const ONLINE_REFRESH_AFTER_MS =
	ONLINE_WINDOW_MS - ONLINE_REFRESH_MARGIN_MS;
const TICK_MS = 60 * 1000;

let onlineRefreshedAt: number | null = null;

export async function beatOnlinePresence(): Promise<void> {
	if (typeof document !== 'undefined' && document.hidden) return;
	if (!getPreferencesSnapshot().stayOnline && !useGridStore.getState().viewActive) return;
	if (onlineRefreshedAt !== null && now() - onlineRefreshedAt < ONLINE_REFRESH_AFTER_MS)
		return;
	await useGridStore.getState().refresh({ background: true });
	onlineRefreshedAt = now();
}

export function startOnlineHeartbeat(): () => void {
	const timer = setInterval(() => void beatOnlinePresence(), TICK_MS);
	return () => clearInterval(timer);
}
