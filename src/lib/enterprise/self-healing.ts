/**
 * Enterprise Self-Healing — Retry, Circuit Breaker, Bulkhead, Fallback, Timeout
 * Gold standard: resilient, self-healing, observable
 */

export type RetryOptions = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitter: boolean;
  retryable?: (error: unknown) => boolean;
};

export const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  factor: 2,
  jitter: true,
  retryable: (error) => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset") || msg.includes("etimedout")) return true;
      if (msg.includes("429") || msg.includes("503") || msg.includes("502") || msg.includes("504")) return true;
    }
    return false;
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterDelay(delay: number): number {
  return delay * (0.5 + Math.random() * 0.5);
}

export async function retry<T>(fn: () => Promise<T>, opts: Partial<RetryOptions> = {}): Promise<T> {
  const options = { ...DEFAULT_RETRY, ...opts };
  let lastError: unknown;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.maxAttempts) break;
      if (options.retryable && !options.retryable(error)) throw error;
      const actualDelay = options.jitter ? jitterDelay(delay) : delay;
      await sleep(actualDelay);
      delay = Math.min(delay * options.factor, options.maxDelayMs);
    }
  }
  throw lastError;
}

export type CircuitState = "closed" | "open" | "half-open";

export type CircuitBreakerOptions = {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxAttempts: number;
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0;
  private halfOpenAttempts = 0;

  constructor(private opts: CircuitBreakerOptions) {}

  getState(): CircuitState {
    if (this.state === "open" && Date.now() > this.nextAttempt) this.state = "half-open";
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === "open") throw new Error(`Circuit breaker open — next attempt at ${new Date(this.nextAttempt).toISOString()}`);

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === "half-open") {
      this.successes++;
      this.halfOpenAttempts++;
      if (this.successes >= this.opts.successThreshold) {
        this.state = "closed";
        this.failures = 0;
        this.successes = 0;
        this.halfOpenAttempts = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure() {
    this.failures++;
    if (this.state === "half-open") {
      this.state = "open";
      this.nextAttempt = Date.now() + this.opts.timeoutMs;
      this.halfOpenAttempts = 0;
      this.successes = 0;
    } else if (this.failures >= this.opts.failureThreshold) {
      this.state = "open";
      this.nextAttempt = Date.now() + this.opts.timeoutMs;
    }
  }

  reset() {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
    this.halfOpenAttempts = 0;
  }
}

export const globalCircuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, opts?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  if (!globalCircuitBreakers.has(name)) {
    globalCircuitBreakers.set(
      name,
      new CircuitBreaker({
        failureThreshold: opts?.failureThreshold ?? 5,
        successThreshold: opts?.successThreshold ?? 2,
        timeoutMs: opts?.timeoutMs ?? 30000,
        halfOpenMaxAttempts: opts?.halfOpenMaxAttempts ?? 3,
      }),
    );
  }
  return globalCircuitBreakers.get(name)!;
}

export type BulkheadOptions = { maxConcurrent: number; maxQueue: number };

export class Bulkhead {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private opts: BulkheadOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.opts.maxConcurrent) {
      if (this.queue.length >= this.opts.maxQueue) throw new Error(`Bulkhead ${this.opts.maxConcurrent} full, queue ${this.opts.maxQueue} full`);
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  getStats() {
    return { active: this.active, queued: this.queue.length, maxConcurrent: this.opts.maxConcurrent, maxQueue: this.opts.maxQueue };
  }
}

export async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, message = "Operation timed out"): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

export async function withFallback<T>(fn: () => Promise<T>, fallback: T | (() => T | Promise<T>)): Promise<T> {
  try {
    return await fn();
  } catch {
    return typeof fallback === "function" ? await (fallback as () => T | Promise<T>)() : fallback;
  }
}

export async function resilient<T>(fn: () => Promise<T>, opts: { retry?: Partial<RetryOptions>; timeoutMs?: number; circuitBreaker?: string; fallback?: T | (() => T | Promise<T>); bulkhead?: string } = {}): Promise<T> {
  let operation = fn;

  if (opts.bulkhead) {
    const bulkhead = new Bulkhead({ maxConcurrent: 10, maxQueue: 20 });
    const original = operation;
    operation = () => bulkhead.execute(original);
  }

  if (opts.circuitBreaker) {
    const breaker = getCircuitBreaker(opts.circuitBreaker);
    const original = operation;
    operation = () => breaker.execute(original);
  }

  if (opts.timeoutMs) {
    const original = operation;
    const timeout = opts.timeoutMs;
    operation = () => withTimeout(original, timeout);
  }

  if (opts.retry) {
    const original = operation;
    const retryOpts = opts.retry;
    operation = () => retry(original, retryOpts);
  }

  if (opts.fallback !== undefined) {
    const original = operation;
    const fb = opts.fallback;
    operation = () => withFallback(original, fb);
  }

  return operation();
}
