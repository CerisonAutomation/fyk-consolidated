/**
 * Live location sharing session manager.
 * Module-level singleton — no Zustand needed.
 * Coordinates go through the snap() pipeline via locate() / watchLocation().
 */

import { locate, watchLocation, type LatLng } from "@/lib/geo";

const UPDATE_INTERVAL_MS = 60_000; // 60 seconds between position broadcasts

interface LiveSession {
  chatId: string;
  durationMs: number;
  startedAt: number;
  expiresAt: number;
  intervalId: ReturnType<typeof setInterval> | null;
  expiryTimerId: ReturnType<typeof setTimeout> | null;
  stopWatch: (() => void) | null;
  lastPosition: LatLng | null;
}

const sessions = new Map<string, LiveSession>();

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Start live location sharing for a chat.
 *
 * Immediately resolves a GPS fix, then sets up a watchPosition + a 60-second
 * interval that broadcasts the latest snapped position via `onPositionUpdate`.
 * The session auto-expires after `durationMs`.
 */
export function startLiveSharing(
  chatId: string,
  durationMs: number,
  onPositionUpdate: (lat: number, lng: number) => void,
): void {
  // Stop any existing session for this chat first
  stopLiveSharing(chatId);

  const now = Date.now();
  const expiresAt = now + durationMs;

  const session: LiveSession = {
    chatId,
    durationMs,
    startedAt: now,
    expiresAt,
    intervalId: null,
    expiryTimerId: null,
    stopWatch: null,
    lastPosition: null,
  };

  // Watch position (snapped via watchLocation)
  session.stopWatch = watchLocation((geoState) => {
    if (geoState.coords) {
      session.lastPosition = geoState.coords;
    }
  });

  // Broadcast every 60 seconds
  session.intervalId = setInterval(() => {
    if (Date.now() >= expiresAt) {
      stopLiveSharing(chatId);
      return;
    }
    if (session.lastPosition) {
      onPositionUpdate(session.lastPosition.lat, session.lastPosition.lng);
    }
  }, UPDATE_INTERVAL_MS);

  // Immediate first fix via locate()
  locate().then((geoState) => {
    if (geoState.status === "granted" && geoState.coords) {
      session.lastPosition = geoState.coords;
      onPositionUpdate(geoState.coords.lat, geoState.coords.lng);
    }
  });

  // Auto-expire
  session.expiryTimerId = setTimeout(() => {
    stopLiveSharing(chatId);
  }, durationMs);

  sessions.set(chatId, session);
}

/**
 * Stop live location sharing for a chat.
 * Clears the watch, interval, and expiry timer.
 */
export function stopLiveSharing(chatId: string): void {
  const session = sessions.get(chatId);
  if (!session) return;

  session.stopWatch?.();
  if (session.intervalId != null) clearInterval(session.intervalId);
  if (session.expiryTimerId != null) clearTimeout(session.expiryTimerId);

  sessions.delete(chatId);
}

/**
 * Check whether a chat currently has an active live session.
 */
export function isActive(chatId: string): boolean {
  const session = sessions.get(chatId);
  if (!session) return false;
  if (Date.now() >= session.expiresAt) {
    // Lazy cleanup
    stopLiveSharing(chatId);
    return false;
  }
  return true;
}

/**
 * Remaining time in ms for an active session, or 0 if none / expired.
 */
export function getRemainingTime(chatId: string): number {
  const session = sessions.get(chatId);
  if (!session) return 0;
  const remaining = session.expiresAt - Date.now();
  if (remaining <= 0) {
    stopLiveSharing(chatId);
    return 0;
  }
  return remaining;
}

/**
 * Get the expiry timestamp for a session, or undefined if none.
 */
export function getExpiresAt(chatId: string): number | undefined {
  return sessions.get(chatId)?.expiresAt;
}

/**
 * Number of currently active sessions (useful for diagnostics).
 */
export function activeSessionCount(): number {
  return sessions.size;
}
