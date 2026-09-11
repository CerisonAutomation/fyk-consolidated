/**
 * nsfw-detect.ts
 * Image content safety scanning using Transformers.js.
 *
 * Production patterns per docs:
 *  - Uses Transformers.js image-classification pipeline (replaces nsfwjs)
 *  - MobileNet v2 for fast, lightweight classification
 *  - WebGPU acceleration with WASM fallback
 *  - Proper error categorization for ML operations
 *  - Graceful degradation when model unavailable
 *
 * Note: The original implementation used nsfwjs loaded via script tag.
 * Per the documentation, the recommended pattern is:
 *   pipeline('image-classification', 'Xenova/mobilenet_v2_1.0_224')
 * This provides consistent API with other ML components and uses the
 * same CDN loading pattern as classifier/generator.
 */

import { loadNsfwDetector, type MLError } from "./bootstrap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NSFWCategory = "safe" | "nsfw" | "unavailable";

export interface ScanResult {
  /** Whether the image is considered safe */
  ok: boolean;
  /** NSFW probability score (0-1) */
  score: number;
  /** Whether the ML model was used */
  source: "model" | "unavailable";
  /** Detected categories with scores */
  categories?: Array<{ label: string; score: number }>;
}

// ---------------------------------------------------------------------------
// Image loading helper
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject({ code: "INFERENCE_FAILED" as MLError["code"], message: `Failed to load image: ${src}` });
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// NSFW scanning
// ---------------------------------------------------------------------------

/**
 * Scan an image for NSFW content using Transformers.js.
 *
 * Per docs: uses image-classification pipeline with MobileNet v2.
 * The model classifies images into categories; we check for
 * inappropriate content patterns.
 *
 * @param dataUrl - Image source (data URL, blob URL, or HTTP URL)
 * @returns Scan result with safety assessment
 */
export async function scanImage(dataUrl: string): Promise<ScanResult> {
  if (!dataUrl) {
    return { ok: false, score: 0, source: "unavailable" };
  }

  try {
    const pipe = await loadNsfwDetector();

    const img = await loadImage(dataUrl);

    const results = await pipe(img);

    // MobileNet v2 classifies into 1000 ImageNet categories.
    // We map certain categories to NSFW risk signals.
    // In production, replace with a dedicated NSFW model like
    // Xenova/nsfw-image-classification when available.
    const categories = (results || []).map((r: any) => ({
      label: r.label,
      score: r.score,
    }));

    // Simple risk scoring based on model output
    // For production: use a dedicated NSFW detection model
    const riskCategories = [
      "bikini", "swimsuit", "brassiere", "underwear",
      "miniskirt", "slipper_(footwear)",
    ];

    let riskScore = 0;
    for (const cat of categories) {
      if (riskCategories.some((rc) => cat.label.toLowerCase().includes(rc.toLowerCase()))) {
        riskScore = Math.max(riskScore, cat.score);
      }
    }

    return {
      ok: riskScore < 0.7,
      score: riskScore,
      source: "model",
      categories,
    };
  } catch (err) {
    const mlErr = err as MLError;
    if (mlErr.code === "TIMEOUT") {
      console.debug("[nsfw-detect] Model load timeout");
    } else if (mlErr.code === "MODEL_LOAD_FAILED") {
      console.warn("[nsfw-detect] Model load failed:", mlErr.message);
    } else {
      console.debug("[nsfw-detect] Scan error:", mlErr.message ?? err);
    }

    return { ok: false, score: 0, source: "unavailable" };
  }
}
