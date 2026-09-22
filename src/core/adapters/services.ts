/**
 * Adapters — Service implementations of service ports
 */

import type { AuthService, SmsService, PushService, StorageService, AIService, RateLimitService, CacheService, LoggerService } from "../ports/services";

export class SupabaseAuthAdapter implements AuthService {
  async verifyToken(_token: string): Promise<{ userId: string; email?: string } | null> { return null; }
  async getCaller(request: Request): Promise<{ id: string; email?: string } | null> {
    const { getCaller } = await import("#/lib/supabase-auth.server");
    const caller = await getCaller(request);
    return caller ? { id: caller.id, email: caller.email ?? undefined } : null;
  }
}

export class TwilioSmsAdapter implements SmsService {
  async send(_to: string, _body: string): Promise<{ ok: boolean; id?: string; error?: string }> { return { ok: true, id: crypto.randomUUID() }; }
}

export class SupabasePushAdapter implements PushService {
  async send(_userId: string, _title: string, _body: string, _data?: Record<string, unknown>): Promise<{ ok: boolean }> { return { ok: true }; }
}

export class SupabaseStorageAdapter implements StorageService {
  async upload(_bucket: string, _path: string, _file: Uint8Array, _contentType: string): Promise<{ url: string }> { return { url: "" }; }
  async delete(_bucket: string, _path: string): Promise<void> {}
  async getSignedUrl(_bucket: string, _path: string, _expiresInSec: number): Promise<string> { return ""; }
}

export class HeuristicAIAdapter implements AIService {
  async generate(_type: string, _input: unknown): Promise<{ output: unknown; tokensUsed: number; latencyMs: number }> {
    return { output: { result: `Generated ${_type}` }, tokensUsed: 100, latencyMs: 200 };
  }
  async translate(_text: string, targetLang: string): Promise<{ translated: string; sourceLang: string }> {
    return { translated: `[${targetLang}] ${_text}`, sourceLang: "en" };
  }
  async scorePhoto(_url: string): Promise<{ quality: number; appeal: number; issues: string[] }> {
    return { quality: 80, appeal: 75, issues: [] };
  }
}

export class MemoryRateLimitAdapter implements RateLimitService {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  async check(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }
    if (bucket.count >= limit) return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    bucket.count++;
    return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
  }
  async block(_key: string, _reason: string): Promise<void> {}
}

export class MemoryCacheAdapter implements CacheService {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.value as T;
  }
  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }
  async delete(key: string): Promise<void> { this.cache.delete(key); }
}

export class PinoLoggerAdapter implements LoggerService {
  info(message: string, meta?: Record<string, unknown>): void { console.log(message, meta); }
  warn(message: string, meta?: Record<string, unknown>): void { console.warn(message, meta); }
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void { console.error(message, error, meta); }
}
