/**
 * Pause / Burnout Mode — 27.2
 * Freezes profile (invisible in browse, no new matches) for duration without deleting.
 */

export type PauseMode = {
  enabled: boolean;
  reason?: string;
  pausedAt?: string;
  resumeAt?: string; // null = indefinite
  durationDays?: number;
};

export const PAUSE_DURATIONS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "Indefinite", days: null },
] as const;

export function createPause(durationDays: number | null, reason?: string): PauseMode {
  const now = new Date();
  return {
    enabled: true,
    reason,
    pausedAt: now.toISOString(),
    resumeAt: durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
    durationDays: durationDays ?? undefined,
  };
}

export function isPaused(pause: PauseMode | null): boolean {
  if (!pause?.enabled) return false;
  if (!pause.resumeAt) return true; // indefinite
  return new Date(pause.resumeAt).getTime() > Date.now();
}

export function shouldAutoResume(pause: PauseMode | null): boolean {
  if (!pause?.enabled) return false;
  if (!pause.resumeAt) return false;
  return new Date(pause.resumeAt).getTime() <= Date.now();
}

export function getPauseRemaining(pause: PauseMode | null): { days: number; hours: number; indefinite: boolean } {
  if (!pause?.enabled) return { days: 0, hours: 0, indefinite: false };
  if (!pause.resumeAt) return { days: 0, hours: 0, indefinite: true };
  const remaining = new Date(pause.resumeAt).getTime() - Date.now();
  if (remaining <= 0) return { days: 0, hours: 0, indefinite: false };
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours, indefinite: false };
}
