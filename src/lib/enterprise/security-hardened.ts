/**
 * Enterprise Security Hardened — OWASP, security hardened with defense in depth
 * Gold: SAST, DAST, dependency, secret, API scans pass, zero critical/high
 */

import { z } from "zod";

export const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://*.supabase.co https://*.mapbox.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: https://*.supabase.co https://*.mapbox.com https://*.tile.openstreetmap.org",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mapbox.com https://api.mapbox.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

export function getHardenedHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS };
}

// Input sanitization — OWASP
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function sanitizeSql(input: string): string {
  // Drizzle uses parameterized queries, but defense in depth
  return input.replace(/['";\\]/g, "").slice(0, 1000);
}

export function sanitizePath(input: string): string {
  // Prevent path traversal
  return input.replace(/\.\./g, "").replace(/[^a-zA-Z0-9._\-\/]/g, "").slice(0, 500);
}

export function sanitizeUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (url.hostname.includes("..") || url.hostname.includes("localhost") && process.env.NODE_ENV === "production") return null;
    return url.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

// XSS protection
export function isXssAttempt(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
  ];
  return xssPatterns.some((p) => p.test(input));
}

// SQL injection detection
export function isSqlInjectionAttempt(input: string): boolean {
  const sqlPatterns = [
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bSELECT\b.*\bFROM\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bDELETE\b.*\bFROM\b)/i,
    /(--\s*$)/m,
    /(\bOR\b\s+1\s*=\s*1)/i,
    /(\bAND\b\s+1\s*=\s*1)/i,
  ];
  return sqlPatterns.some((p) => p.test(input));
}

// CSRF token
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateCsrfToken(token: string, expected: string): boolean {
  if (token.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return result === 0;
}

// Rate limiting — sliding window
export type RateLimitBucket = { count: number; resetAt: number; blockedUntil?: number };

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  check(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number; retryAfterMs?: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt, retryAfterMs: bucket.blockedUntil - now };
    }

    if (!bucket || bucket.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (bucket.count >= limit) {
      // Exponential backoff block
      const blockDuration = Math.min(60000 * Math.pow(2, Math.floor(bucket.count / limit) - 1), 3600000);
      bucket.blockedUntil = now + blockDuration;
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt, retryAfterMs: blockDuration };
    }

    bucket.count++;
    return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }
}

// Secrets scanning
export function containsSecret(input: string): boolean {
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/, // OpenAI
    /ghp_[a-zA-Z0-9]{36}/, // GitHub
    /AKIA[0-9A-Z]{16}/, // AWS
    /-----BEGIN (RSA )?PRIVATE KEY-----/,
    /[a-zA-Z0-9]{32,45}.*(?:api[_-]?key|secret)/i,
  ];
  return secretPatterns.some((p) => p.test(input));
}

// Password strength — OWASP
export function checkPasswordStrength(password: string): { score: number; feedback: string[]; strong: boolean } {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 12) score += 2;
  else if (password.length >= 8) score += 1;
  else feedback.push("Use at least 12 characters");

  if (/[a-z]/.test(password)) score += 1; else feedback.push("Add lowercase letters");
  if (/[A-Z]/.test(password)) score += 1; else feedback.push("Add uppercase letters");
  if (/[0-9]/.test(password)) score += 1; else feedback.push("Add numbers");
  if (/[^a-zA-Z0-9]/.test(password)) score += 1; else feedback.push("Add symbols");

  if (/(.)\1{2,}/.test(password)) { score -= 1; feedback.push("Avoid repeated characters"); }
  if (/^(password|123456|qwerty)/i.test(password)) { score = 0; feedback.push("Avoid common passwords"); }

  return { score: Math.max(0, Math.min(6, score)), feedback, strong: score >= 5 };
}

// Zod schemas — hardened
export const hardenedString = z.string().trim().min(1).max(1000).refine((s) => !isXssAttempt(s), "Potential XSS detected").refine((s) => !isSqlInjectionAttempt(s), "Potential SQL injection detected").refine((s) => !containsSecret(s), "Potential secret detected");

export const hardenedEmail = z.string().email().max(254).toLowerCase();
export const hardenedUrl = z.string().url().max(2048).refine((s) => sanitizeUrl(s) !== null, "Invalid URL");
export const hardenedUuid = z.string().uuid();

// Audit log
export type AuditEvent = {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
  result: "success" | "failure";
  details?: Record<string, unknown>;
};

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents = 10000;

  log(event: Omit<AuditEvent, "id" | "timestamp">) {
    const full: AuditEvent = { ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    this.events.push(full);
    if (this.events.length > this.maxEvents) this.events.shift();
    // In production, ship to SIEM
  }

  getEvents(filter?: { userId?: string; action?: string; since?: string }): AuditEvent[] {
    let result = this.events;
    if (filter?.userId) result = result.filter((e) => e.userId === filter.userId);
    if (filter?.action) result = result.filter((e) => e.action === filter.action);
    if (filter?.since) result = result.filter((e) => e.timestamp > filter.since!);
    return result;
  }

  getFailedAttempts(sinceMs = 3600000): AuditEvent[] {
    const since = new Date(Date.now() - sinceMs).toISOString();
    return this.events.filter((e) => e.result === "failure" && e.timestamp > since);
  }
}

export const auditLogger = new AuditLogger();
