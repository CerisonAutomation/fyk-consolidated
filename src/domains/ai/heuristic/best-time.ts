/**
 * Best-Time-to-Message — AI feature 25.11
 * Learns each match's reply patterns and suggests optimal send moment.
 */

export type ReplyPattern = {
  userId: string;
  messages: { timestamp: number; responseDelay?: number }[];
  timezone?: string;
};

export type BestTimeResult = {
  bestHour: number; // 0-23
  bestDay: number; // 0-6 (0=Sunday)
  confidence: number;
  reason: string;
  nextSuggestedSend: string; // ISO
  nudgeText: string;
};

export function analyzeBestTime(pattern: ReplyPattern): BestTimeResult | null {
  if (pattern.messages.length < 5) return null;

  // Group by hour
  const hourCounts = new Array(24).fill(0);
  const hourResponseSum = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);

  for (const msg of pattern.messages) {
    const date = new Date(msg.timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    hourCounts[hour]++;
    dayCounts[day]++;
    if (msg.responseDelay) {
      hourResponseSum[hour] += msg.responseDelay;
    }
  }

  // Find hour with most activity and fastest replies
  let bestHour = 20; // default 8pm
  let maxScore = -1;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] === 0) continue;
    const avgDelay = hourResponseSum[h] / Math.max(1, hourCounts[h]);
    // Prefer hours with high count and low delay
    const score = hourCounts[h] * 10 - avgDelay / (60 * 1000);
    if (score > maxScore) {
      maxScore = score;
      bestHour = h;
    }
  }

  let bestDay = 5; // default Friday
  let maxDayCount = -1;
  for (let d = 0; d < 7; d++) {
    if (dayCounts[d] > maxDayCount) {
      maxDayCount = dayCounts[d];
      bestDay = d;
    }
  }

  const now = new Date();
  const next = new Date();
  next.setHours(bestHour, 15, 0, 0); // 15 min past hour
  if (next.getTime() < now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  const confidence = Math.min(95, Math.round((pattern.messages.length / 20) * 100));

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const reason = `They reply most on ${dayNames[bestDay]}s around ${bestHour}:00-${bestHour + 1}:00`;

  return {
    bestHour,
    bestDay,
    confidence,
    reason,
    nextSuggestedSend: next.toISOString(),
    nudgeText: `They reply ${bestHour}-${bestHour + 2}pm — send yours around ${bestHour}:15pm for fastest response`,
  };
}

export const NUDGE_COOLDOWN_HOURS = 24;
export const MAX_NUDGES_PER_CONVERSATION = 1;

export function shouldNudge(lastNudgeAt: string | null): boolean {
  if (!lastNudgeAt) return true;
  const hoursSince = (Date.now() - new Date(lastNudgeAt).getTime()) / (1000 * 60 * 60);
  return hoursSince >= NUDGE_COOLDOWN_HOURS;
}
