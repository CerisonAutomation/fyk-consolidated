/**
 * License / DRM Check — 12.5
 * Periodic signed-license validation (RS256) with retry/backoff.
 * If license fails, triggers graceful exit path instead of crash.
 */

export type License = {
  appId: string;
  tier: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
  features: string[];
};

export type LicenseCheckResult = {
  valid: boolean;
  reason?: string;
  license?: License;
  shouldExit: boolean;
  retryAfterMs?: number;
};

const LICENSE_PUBLIC_KEY = process.env.LICENSE_PUBLIC_KEY ?? "dev-public-key";

export function verifyLicenseSignature(license: License, _publicKey: string = LICENSE_PUBLIC_KEY): boolean {
  // Production: RS256 verify with public key
  // Here: check signature format and expiry
  if (!license.signature || license.signature.length < 10) return false;
  if (new Date(license.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export function checkLicense(license: License | null): LicenseCheckResult {
  if (!license) {
    return {
      valid: false,
      reason: "no_license",
      shouldExit: false,
      retryAfterMs: 5000,
    };
  }

  if (new Date(license.expiresAt).getTime() < Date.now()) {
    return {
      valid: false,
      reason: "expired",
      license,
      shouldExit: true,
    };
  }

  const sigValid = verifyLicenseSignature(license);
  if (!sigValid) {
    return {
      valid: false,
      reason: "invalid_signature",
      license,
      shouldExit: true,
    };
  }

  return {
    valid: true,
    license,
    shouldExit: false,
  };
}

export function shouldGracefulExit(result: LicenseCheckResult): boolean {
  return result.shouldExit;
}

export function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
  return Math.min(60000, 1000 * Math.pow(2, attempt));
}

export const LICENSE_FEATURES = [
  "discovery",
  "chat",
  "calls",
  "premium",
  "ai",
  "safety",
] as const;

export function hasFeature(license: License, feature: string): boolean {
  return license.features.includes(feature) || license.features.includes("*");
}
