/**
 * Ports — Service interfaces, hexagonal architecture
 */

export interface AuthService {
  verifyToken(token: string): Promise<{ userId: string; email?: string } | null>;
  getCaller(request: Request): Promise<{ id: string; email?: string } | null>;
}

export interface SmsService {
  send(to: string, body: string): Promise<{ ok: boolean; id?: string; error?: string }>;
}

export interface PushService {
  send(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<{ ok: boolean }>;
}

export interface StorageService {
  upload(bucket: string, path: string, file: Uint8Array, contentType: string): Promise<{ url: string }>;
  delete(bucket: string, path: string): Promise<void>;
  getSignedUrl(bucket: string, path: string, expiresInSec: number): Promise<string>;
}

export interface AIService {
  generate(type: string, input: unknown): Promise<{ output: unknown; tokensUsed: number; latencyMs: number }>;
  translate(text: string, targetLang: string): Promise<{ translated: string; sourceLang: string }>;
  scorePhoto(url: string): Promise<{ quality: number; appeal: number; issues: string[] }>;
}

export interface RateLimitService {
  check(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
  block(key: string, reason: string): Promise<void>;
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface LoggerService {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
}
