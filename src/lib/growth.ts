import { dayKey, daysBetweenUtcDays } from "@/lib/economy";

/**
 * Growth and retention — engagement notifications, streaks, completion meter, campaigns, analytics funnel
 */

export type EngagementNotification = {
  id: string;
  userId: string;
  type: "admirers" | "match_waiting" | "daily_picks" | "reengage" | "event" | "boost_reminder";
  title: string;
  body: string;
  href?: string;
  scheduledAt: string;
  sentAt?: string;
  read: boolean;
};

export type Streak = {
  userId: string;
  type: "login" | "conversation";
  count: number;
  lastActiveAt: string;
  longestStreak: number;
  atRisk: boolean;
};

export type ProfileCompletion = {
  userId: string;
  percent: number;
  missing: string[];
  perksUnlocked: boolean;
  nextPerk: string;
};

export const COMPLETION_CHECKS: { key: string; label: string; weight: number; check: (profile: any) => boolean }[] = [
  { key: "avatar", label: "Add profile photo", weight: 20, check: (p) => !!p.avatar },
  { key: "bio", label: "Write bio (50+ chars)", weight: 15, check: (p) => (p.bio?.length ?? 0) >= 50 },
  { key: "photos", label: "Add 3+ photos", weight: 15, check: (p) => (p.photos?.length ?? 0) >= 3 },
  { key: "interests", label: "Add interests", weight: 10, check: (p) => (p.interests?.length ?? 0) >= 3 },
  { key: "tribes", label: "Select tribe", weight: 10, check: (p) => (p.tribes?.length ?? 0) >= 1 },
  { key: "location", label: "Set location", weight: 10, check: (p) => !!p.city },
  { key: "social", label: "Link social", weight: 10, check: (p) => (p.socialLinks?.length ?? 0) >= 1 },
  { key: "verification", label: "Verify profile", weight: 10, check: (p) => p.verification >= 2 },
];

export function calculateCompletion(profile: any): ProfileCompletion {
  let earned = 0;
  const missing: string[] = [];
  for (const check of COMPLETION_CHECKS) {
    if (check.check(profile)) earned += check.weight;
    else missing.push(check.label);
  }
  const percent = Math.min(100, earned);
  return { userId: profile.id, percent, missing, perksUnlocked: percent >= 80, nextPerk: percent < 80 ? "One free boost at 80%!" : "Profile complete! 🎉" };
}

/**
 * Distinct UTC calendar days, newest first, from any mix of timestamps.
 *
 * A streak is a property of *days*, not of instants, and the version this replaced
 * measured instants: it rounded the hour difference between two logins to a day
 * count. Two consequences, both wrong. Signing in at 23:00 and again at 01:00 is two
 * calendar days and 0.08 of a day apart, so it rounded to 0 and the streak did not
 * advance; two logins 25 hours apart on the same weekday pattern rounded to 1 and
 * counted a day nobody was absent for. Everything here goes through `dayKey` first,
 * so the same day can only ever appear once and only whole days separate entries.
 */
export function distinctUtcDays(values: (string | Date | null | undefined)[]): string[] {
  const days = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    days.add(dayKey(date));
  }
  return [...days].sort().reverse();
}

/** Whole days from `earlier` to `later` given two `YYYY-MM-DD` keys. */
function daysApart(earlier: string, later: string): number {
  return daysBetweenUtcDays(new Date(`${earlier}T00:00:00Z`), new Date(`${later}T00:00:00Z`));
}

/**
 * The current streak over a list of activity timestamps.
 *
 * `count` is 0 unless the run is still alive — the most recent active day is today or
 * yesterday. A user who last opened the app three weeks ago does not have a streak of
 * whatever they did that week; they have a `longestStreak` and nothing to keep.
 * `atRisk` means the run survives on one more day of activity: yesterday was active,
 * today is not yet.
 */
export function calculateStreak(
  lastActiveDates: (string | Date)[],
  now: Date = new Date(),
): Streak {
  const days = distinctUtcDays(lastActiveDates);
  if (days.length === 0) {
    return { userId: "", type: "login", count: 0, lastActiveAt: "", longestStreak: 0, atRisk: false };
  }

  const instants = lastActiveDates
    .map((value) => (value instanceof Date ? value.getTime() : Date.parse(value)))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => b - a);

  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const alive = days[0] === today || days[0] === yesterday;

  let count = 0;
  if (alive) {
    count = 1;
    for (let i = 1; i < days.length; i++) {
      if (daysApart(days[i], days[i - 1]) !== 1) break;
      count++;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysApart(days[i], days[i - 1]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return {
    userId: "",
    type: "login",
    count,
    lastActiveAt: instants.length > 0 ? new Date(instants[0]).toISOString() : "",
    longestStreak: longest,
    atRisk: alive && days[0] === yesterday,
  };
}

export type AnalyticsEvent = { event: string; userId?: string; properties?: Record<string, unknown>; timestamp: string; };

export const FUNNEL_STEPS = ["signup","onboarding_started","profile_completed","first_browse","first_tap","first_match","first_message","subscription_started","retention_d7","retention_d30"] as const;
export type FunnelStep = typeof FUNNEL_STEPS[number] | "first_like" | "subscription" | "retention_d7" | "retention_d30";

export function trackFunnelStep(userId: string, step: FunnelStep, properties?: Record<string, unknown>): AnalyticsEvent {
  return { event: `funnel_${step}`, userId, properties, timestamp: new Date().toISOString() };
}

export function getFunnelProgress(steps: { step: string; reachedAt: string }[]): { completed: number; total: number; percent: number; nextStep: string | null } {
  const completedSteps = new Set(steps.map(s => s.step));
  const total = FUNNEL_STEPS.length;
  const completed = FUNNEL_STEPS.filter(s => completedSteps.has(s)).length;
  const percent = Math.round((completed / total) * 100);
  const nextStep = FUNNEL_STEPS.find(s => !completedSteps.has(s)) ?? null;
  return { completed, total, percent, nextStep };
}

export type ReengagementCampaign = { id: string; name: string; segment: string; title: string; body: string; cta: string; href: string; scheduledAt: string; sentCount: number; openRate?: number; };

export function shouldSendNudge(lastNudges: any[] | string, typeOrOptions?: any): boolean {
  // Overloaded: if first arg is string, it's lastActiveAt
  if (typeof lastNudges === "string") {
    const lastActiveAt = lastNudges;
    const type = typeOrOptions as EngagementNotification["type"];
    const hoursSince = (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60);
    switch (type) {
      case "admirers": return hoursSince > 24;
      case "match_waiting": return hoursSince > 2;
      case "daily_picks": return hoursSince > 20;
      case "reengage": return hoursSince > 72;
      default: return hoursSince > 24;
    }
  }
  // If array, check rate limiting
  const nudges = lastNudges as any[];
  const options = typeOrOptions as { maxPerDay?: number; quietHours?: { start: number; end: number } } | undefined;
  const maxPerDay = options?.maxPerDay ?? 3;
  const today = new Date().toDateString();
  const todayCount = nudges.filter(n => new Date(n.sentAt ?? n.createdAt ?? n.timestamp ?? Date.now()).toDateString() === today).length;
  if (todayCount >= maxPerDay) return false;
  if (options?.quietHours) {
    const hour = new Date().getHours();
    const { start, end } = options.quietHours;
    if (start < end) { if (hour >= start && hour < end) return false; }
    else { if (hour >= start || hour < end) return false; }
  }
  return true;
}
