/**
 * AI Catfish / Fake-Photo Detection — AI feature 25.18
 * Scores profile photos for reverse-image matches and deepfake artifacts.
 */

export type CatfishCheck = {
  photoId: string;
  url: string;
  riskScore: number; // 0-100, higher = more likely fake
  flags: string[];
  requiresHumanReview: boolean;
  blocked: boolean;
  reasons: string[];
};

export type CatfishSignals = {
  reverseImageMatches: number; // how many other profiles use same image
  deepfakeScore: number; // 0-1 from ML model
  metadata: {
    hasExif: boolean;
    exifSoftware?: string;
    creationDate?: string;
  };
  faceCount: number;
  imageQuality: number; // 0-100
};

const SUSPICIOUS_SOFTWARE = ["FaceApp", "DeepFaceLab", "FakeApp", "Photoshop AI"];

export function checkCatfish(photoId: string, url: string, signals: CatfishSignals): CatfishCheck {
  let risk = 0;
  const flags: string[] = [];
  const reasons: string[] = [];

  if (signals.reverseImageMatches > 0) {
    risk += Math.min(60, signals.reverseImageMatches * 20);
    flags.push("reverse_image_match");
    reasons.push(`Image found on ${signals.reverseImageMatches} other profiles`);
  }

  if (signals.deepfakeScore > 0.7) {
    risk += 40;
    flags.push("deepfake_suspected");
    reasons.push(`Deepfake score ${signals.deepfakeScore.toFixed(2)}`);
  } else if (signals.deepfakeScore > 0.4) {
    risk += 15;
    flags.push("possible_ai_generated");
    reasons.push(`Possible AI generation: ${signals.deepfakeScore.toFixed(2)}`);
  }

  if (signals.metadata.exifSoftware && SUSPICIOUS_SOFTWARE.some((s) => signals.metadata.exifSoftware!.includes(s))) {
    risk += 30;
    flags.push("suspicious_editing_software");
    reasons.push(`Edited with ${signals.metadata.exifSoftware}`);
  }

  if (signals.faceCount === 0) {
    risk += 10;
    flags.push("no_face_detected");
    reasons.push("No face detected in profile photo");
  } else if (signals.faceCount > 1) {
    risk += 5;
    flags.push("multiple_faces");
    reasons.push("Multiple faces detected");
  }

  if (signals.imageQuality < 20) {
    risk += 10;
    flags.push("low_quality");
    reasons.push("Very low quality image");
  }

  // Clamp
  risk = Math.min(100, risk);

  const requiresHumanReview = risk >= 30;
  const blocked = risk >= 70;

  return {
    photoId,
    url,
    riskScore: risk,
    flags,
    requiresHumanReview,
    blocked,
    reasons,
  };
}

export function heuristicDeepfakeScore(url: string): number {
  // Production: TensorFlow Lite model
  // Heuristic: check for common AI artifacts in URL or metadata
  const lower = url.toLowerCase();
  if (lower.includes("ai") || lower.includes("generated") || lower.includes("midjourney") || lower.includes("dalle")) {
    return 0.85;
  }
  return Math.random() * 0.3; // baseline low
}
