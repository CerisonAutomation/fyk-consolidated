/**
 * Trust & Risk Scoring — AI feature 25.14
 * Hidden per-user safety score combining verification, reports, scam signals.
 */

export type SafetySignals = {
  userId: string;
  verified: boolean;
  reportCount: number;
  reportReasons: string[];
  accountAgeDays: number;
  photoCount: number;
  bioLength: number;
  hasSocialLinks: boolean;
  messageVelocity: number; // msgs per hour
  scamKeywords: string[];
  underageKeywords: string[];
  blockedByCount: number;
  isPremium: boolean;
};

export type TrustScore = {
  score: number; // 0-100, higher = safer
  riskLevel: "low" | "medium" | "high" | "critical";
  reasons: string[];
  flagged: boolean;
  requiresReview: boolean;
  autoActions: string[];
};

const SCAM_KEYWORDS = [
  "send money", "cashapp", "venmo", "gift card", "bitcoin", "crypto",
  "investment", "onlyfans", "pay me", "sugar daddy", "sugar baby",
];

const UNDERAGE_KEYWORDS = [
  "17", "16", "15", "14", "high school", "minor", "young",
];

export function calculateTrustScore(signals: SafetySignals): TrustScore {
  let score = 50;
  const reasons: string[] = [];
  const autoActions: string[] = [];

  // Positive signals
  if (signals.verified) {
    score += 20;
    reasons.push("verified");
  }
  if (signals.accountAgeDays > 90) {
    score += 10;
    reasons.push("old_account");
  }
  if (signals.photoCount >= 3) {
    score += 5;
    reasons.push("has_photos");
  }
  if (signals.bioLength > 50) {
    score += 5;
    reasons.push("has_bio");
  }
  if (signals.isPremium) {
    score += 5;
    reasons.push("premium");
  }

  // Negative signals
  if (signals.reportCount > 0) {
    const penalty = Math.min(30, signals.reportCount * 10);
    score -= penalty;
    reasons.push(`reported_${signals.reportCount}_times`);
    if (signals.reportCount >= 3) autoActions.push("flag_for_review");
  }

  if (signals.blockedByCount > 5) {
    score -= 15;
    reasons.push("blocked_by_many");
  }

  if (signals.messageVelocity > 30) {
    score -= 20;
    reasons.push("high_velocity_spam_risk");
    autoActions.push("rate_limit");
  }

  if (signals.scamKeywords.length > 0) {
    score -= 25;
    reasons.push(`scam_keywords: ${signals.scamKeywords.join(",")}`);
    autoActions.push("flag_for_review");
  }

  if (signals.underageKeywords.length > 0) {
    score = 0;
    reasons.push(`underage_keywords: ${signals.underageKeywords.join(",")}`);
    autoActions.push("urgent_review", "suspend");
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  let riskLevel: TrustScore["riskLevel"] = "low";
  if (score < 20) riskLevel = "critical";
  else if (score < 40) riskLevel = "high";
  else if (score < 60) riskLevel = "medium";

  const flagged = riskLevel === "high" || riskLevel === "critical";
  const requiresReview = flagged || signals.reportCount >= 2;

  return {
    score,
    riskLevel,
    reasons,
    flagged,
    requiresReview,
    autoActions,
  };
}

export function detectScamKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SCAM_KEYWORDS.filter((kw) => lower.includes(kw));
}

export function detectUnderageKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return UNDERAGE_KEYWORDS.filter((kw) => lower.includes(kw));
}

export function isHighRisk(score: TrustScore): boolean {
  return score.riskLevel === "high" || score.riskLevel === "critical";
}
