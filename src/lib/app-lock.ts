/**
 * App Lock — 1.7, Security Feature
 * Optional gate before opening app: PIN or device fingerprint (biometric).
 */

export type AppLockMethod = "pin" | "biometric" | "none";

export type AppLockConfig = {
  enabled: boolean;
  method: AppLockMethod;
  pinHash?: string; // hashed PIN, never plain
  biometricEnabled: boolean;
  timeoutMinutes: number; // auto-lock after X min background
  createdAt: string;
};

export const DEFAULT_APP_LOCK: AppLockConfig = {
  enabled: false,
  method: "none",
  biometricEnabled: false,
  timeoutMinutes: 5,
  createdAt: new Date().toISOString(),
};

export function hashPin(pin: string): string {
  // Production: use PBKDF2 or bcrypt, not simple hash
  // Here: base64 of pin + salt for demo (real impl uses Web Crypto)
  const salt = "fyk-salt-v1";
  return btoa(`${salt}:${pin}`).slice(0, 32);
}

export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash;
}

export function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{4,8}$/.test(pin)) {
    return { valid: false, error: "PIN must be 4-8 digits" };
  }
  if (/^(\d)\1+$/.test(pin)) {
    return { valid: false, error: "PIN cannot be all same digit" };
  }
  if (pin === "1234" || pin === "0000") {
    return { valid: false, error: "PIN too common" };
  }
  return { valid: true };
}

export async function checkBiometricAvailable(): Promise<boolean> {
  // Production: navigator.credentials + PublicKeyCredential
  if (typeof window === "undefined") return false;
  try {
    // Check if WebAuthn available
    return typeof (window as any).PublicKeyCredential !== "undefined";
  } catch {
    return false;
  }
}

export function shouldLock(lastActiveAt: string, config: AppLockConfig): boolean {
  if (!config.enabled) return false;
  const elapsed = Date.now() - new Date(lastActiveAt).getTime();
  return elapsed > config.timeoutMinutes * 60 * 1000;
}
