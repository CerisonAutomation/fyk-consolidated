/**
 * Image CDN with Tokenized URLs — 12.2
 * Media URLs are signed (token part of URL) and rating-aware.
 * CDN rejects requests without valid token → prevents hotlinking.
 */

export type CdnConfig = {
  baseUrl: string;
  secret: string;
  defaultExpirySec: number;
};

export type SignedUrl = {
  url: string;
  token: string;
  expiresAt: string;
  rating: string;
};

const DEFAULT_CONFIG: CdnConfig = {
  baseUrl: process.env.CDN_BASE_URL ?? "https://cdn.fyk.app",
  secret: process.env.CDN_SECRET ?? "dev-secret-do-not-use-in-prod",
  defaultExpirySec: 3600,
};

export function signMediaUrl(mediaPath: string, rating: string, config: CdnConfig = DEFAULT_CONFIG, expiresInSec?: number): SignedUrl {
  const expirySec = expiresInSec ?? config.defaultExpirySec;
  const expiresAt = new Date(Date.now() + expirySec * 1000);
  const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

  // Payload: path + rating + expiry
  const payload = `${mediaPath}:${rating}:${expiresTimestamp}`;
  const token = generateHmac(payload, config.secret);

  const url = `${config.baseUrl}/${mediaPath}?token=${token}&expires=${expiresTimestamp}&rating=${rating}`;

  return { url, token, expiresAt: expiresAt.toISOString(), rating };
}

export function verifySignedUrl(url: string, config: CdnConfig = DEFAULT_CONFIG): { valid: boolean; reason?: string; mediaPath?: string } {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    const expires = parsed.searchParams.get("expires");
    const rating = parsed.searchParams.get("rating");

    if (!token || !expires || !rating) {
      return { valid: false, reason: "missing_params" };
    }

    const expiresTimestamp = Number(expires);
    if (!Number.isFinite(expiresTimestamp)) {
      return { valid: false, reason: "invalid_expiry" };
    }

    if (Date.now() / 1000 > expiresTimestamp) {
      return { valid: false, reason: "expired" };
    }

    const mediaPath = parsed.pathname.slice(1); // remove leading /
    const payload = `${mediaPath}:${rating}:${expiresTimestamp}`;
    const expectedToken = generateHmac(payload, config.secret);

    if (token !== expectedToken) {
      return { valid: false, reason: "invalid_token" };
    }

    return { valid: true, mediaPath };
  } catch {
    return { valid: false, reason: "invalid_url" };
  }
}

function generateHmac(payload: string, secret: string): string {
  // Production: use crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  // Here: deterministic placeholder
  let hash = 0;
  const combined = `${payload}:${secret}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(16, "0") + Buffer.from(payload).toString("base64url").slice(0, 16);
}

export function isRatingAllowedForUrl(rating: string, userTier: string, isOwner: boolean): boolean {
  if (isOwner) return true;
  switch (rating) {
    case "NEUTRAL":
    case "APP_SAFE":
      return true;
    case "EROTIC":
      return userTier !== "free";
    case "HARDCORE":
      return userTier === "gold" || userTier === "platinum";
    default:
      return false;
  }
}

export function stripExifFromUrl(url: string): string {
  // Production: image processing pipeline strips EXIF/GPS
  // Here: add param to indicate stripping
  const parsed = new URL(url);
  parsed.searchParams.set("strip_exif", "1");
  return parsed.toString();
}
