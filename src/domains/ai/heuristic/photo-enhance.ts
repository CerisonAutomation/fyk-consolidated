/**
 * AI Photo Enhancer & Ordering — 25.5
 * Scores quality (lighting, blur, smile, background) and predicted appeal.
 * Blocked from altering identity-defining features to prevent catfishing.
 */

export type PhotoScore = {
  url: string;
  quality: number; // 0-100
  lighting: number;
  blur: number; // 0=blurry, 100=sharp
  smile: number;
  background: number;
  appeal: number; // predicted profile strength
  issues: string[];
  suggestions: string[];
};

export type PhotoEnhancement = {
  originalUrl: string;
  enhancedUrl?: string;
  adjustments: {
    brightness?: number;
    contrast?: number;
    crop?: { x: number; y: number; width: number; height: number };
  };
  allowed: boolean;
  blockedReason?: string;
};

const BLOCKED_ALTERATIONS = ["face_shape", "birthmarks", "skin_color", "age"];

export function scorePhoto(url: string): PhotoScore {
  // Heuristic scoring — production uses ML model
  const hasGoodLighting = !url.includes("dark");
  const isSharp = !url.includes("blur");

  const lighting = hasGoodLighting ? 75 + Math.floor(Math.random() * 25) : 30 + Math.floor(Math.random() * 30);
  const blur = isSharp ? 80 + Math.floor(Math.random() * 20) : 20 + Math.floor(Math.random() * 40);
  const smile = 50 + Math.floor(Math.random() * 50);
  const background = 60 + Math.floor(Math.random() * 40);

  const quality = Math.round((lighting * 0.3 + blur * 0.3 + smile * 0.2 + background * 0.2));

  const issues: string[] = [];
  const suggestions: string[] = [];

  if (lighting < 50) {
    issues.push("low_lighting");
    suggestions.push("Try brighter lighting");
  }
  if (blur < 50) {
    issues.push("blurry");
    suggestions.push("Use sharper image");
  }
  if (smile < 40) {
    issues.push("no_smile");
    suggestions.push("Smiling photos perform better");
  }

  const appeal = Math.round(quality * 0.8 + (smile > 60 ? 10 : 0));

  return { url, quality, lighting, blur, smile, background, appeal, issues, suggestions };
}

export function rankPhotosByAppeal(urls: string[]): PhotoScore[] {
  return urls.map(scorePhoto).sort((a, b) => b.appeal - a.appeal);
}

export function suggestPhotoOrder(urls: string[]): { ordered: string[]; scores: PhotoScore[]; reason: string } {
  const scored = rankPhotosByAppeal(urls);
  return {
    ordered: scored.map((s) => s.url),
    scores: scored,
    reason: "Ordered by predicted appeal: quality + lighting + smile + background",
  };
}

export function enhancePhoto(url: string, adjustments: PhotoEnhancement["adjustments"]): PhotoEnhancement {
  // Check for blocked alterations
  for (const blocked of BLOCKED_ALTERATIONS) {
    if (JSON.stringify(adjustments).toLowerCase().includes(blocked)) {
      return {
        originalUrl: url,
        adjustments,
        allowed: false,
        blockedReason: `Cannot alter ${blocked} — prevents catfishing`,
      };
    }
  }

  // Only allow safe adjustments: lighting, crop, brightness
  const safe = {
    brightness: adjustments.brightness,
    contrast: adjustments.contrast,
    crop: adjustments.crop,
  };

  return {
    originalUrl: url,
    enhancedUrl: `${url}?enhanced=1&b=${safe.brightness ?? 0}`,
    adjustments: safe,
    allowed: true,
  };
}
