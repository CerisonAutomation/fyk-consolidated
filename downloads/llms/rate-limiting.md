# API Rate Limiting Patterns

> Reference compiled from Cloudflare, OWASP, and industry best practices.
> Source: https://www.cloudflare.com/learning/bots/what-is-rate-limiting/

## Overview

Rate limiting is a strategy for limiting network traffic that puts a cap on how often someone can repeat an action within a certain timeframe. It helps prevent abuse, DDoS attacks, brute force attempts, and API overuse.

---

## Rate Limiting Algorithms

### 1. Fixed Window Counter

Simple counter that resets at fixed intervals.

```typescript
class FixedWindowLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const window = this.windows.get(key);

    if (!window || now > window.resetAt) {
      // New window
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: now + this.windowMs };
    }

    if (window.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: window.resetAt };
    }

    window.count++;
    return { allowed: true, remaining: this.maxRequests - window.count, resetAt: window.resetAt };
  }
}

// Usage
const limiter = new FixedWindowLimiter(100, 60000); // 100 requests per minute
```

**Pros:** Simple, memory-efficient
**Cons:** Burst at window edges, not smooth

### 2. Sliding Window Log

Stores timestamp of each request, counts within sliding window.

```typescript
class SlidingWindowLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests and filter to current window
    const existing = this.requests.get(key) || [];
    const validRequests = existing.filter(ts => ts > windowStart);

    if (validRequests.length >= this.maxRequests) {
      const oldestInWindow = validRequests[0];
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestInWindow + this.windowMs,
      };
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return {
      allowed: true,
      remaining: this.maxRequests - validRequests.length,
      resetAt: now + this.windowMs,
    };
  }
}
```

**Pros:** Smooth rate limiting, accurate
**Cons:** Memory-intensive (stores all timestamps)

### 3. Sliding Window Counter (Hybrid)

Weighted average of current and previous window counts.

```typescript
class SlidingWindowCounter {
  private windows = new Map<string, { prev: number; current: number; currentStart: number }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const prevWindowStart = currentWindowStart - this.windowMs;

    let window = this.windows.get(key);

    if (!window || window.currentStart < currentWindowStart) {
      // Move to new window
      const prevCount = window?.current || 0;
      window = { prev: prevCount, current: 0, currentStart: currentWindowStart };
    }

    // Calculate weighted count
    const elapsedInWindow = now - currentWindowStart;
    const weight = elapsedInWindow / this.windowMs;
    const estimatedCount = window.prev * (1 - weight) + window.current;

    if (estimatedCount >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: currentWindowStart + this.windowMs,
      };
    }

    window.current++;
    this.windows.set(key, window);

    return {
      allowed: true,
      remaining: Math.max(0, Math.floor(this.maxRequests - estimatedCount - 1)),
      resetAt: currentWindowStart + this.windowMs,
    };
  }
}
```

**Pros:** Good balance of accuracy and efficiency
**Cons:** Approximate (not exact)

### 4. Token Bucket

Tokens are added at fixed rate; requests consume tokens.

```typescript
class TokenBucketLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
    private refillInterval: number = 1000 // ms
  ) {}

  isAllowed(key: string, tokens: number = 1): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
    }

    // Refill tokens
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.refillInterval) * this.refillRate);
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens < tokens) {
      return { allowed: false, remaining: bucket.tokens };
    }

    bucket.tokens -= tokens;
    this.buckets.set(key, bucket);

    return { allowed: true, remaining: bucket.tokens };
  }
}

// Usage: 10 tokens max, refill 2 tokens per second
const bucket = new TokenBucketLimiter(10, 2);
```

**Pros:** Allows bursts, smooth limiting
**Cons:** More complex, state management

### 5. Leaky Bucket

Requests enter a queue; processed at fixed rate.

```typescript
class LeakyBucketLimiter {
  private queues = new Map<string, { queue: number[]; lastLeak: number }>();

  constructor(
    private capacity: number,
    private leakRate: number, // requests per second
    private leakInterval: number = 1000
  ) {}

  isAllowed(key: string): { allowed: boolean; queueSize: number } {
    const now = Date.now();
    let queue = this.queues.get(key);

    if (!queue) {
      queue = { queue: [], lastLeak: now };
    }

    // Leak (process) requests
    const timePassed = now - queue.lastLeak;
    const requestsToLeak = Math.floor((timePassed / this.leakInterval) * this.leakRate);
    queue.queue = queue.queue.slice(requestsToLeak);
    queue.lastLeak = now;

    if (queue.queue.length >= this.capacity) {
      return { allowed: false, queueSize: queue.queue.length };
    }

    queue.queue.push(now);
    this.queues.set(key, queue);

    return { allowed: true, queueSize: queue.queue.length };
  }
}
```

**Pros:** Smooths traffic, predictable output rate
**Cons:** Adds latency, memory for queue

---

## Express.js Middleware Implementation

### Basic Rate Limiter

```typescript
import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response, next: NextFunction, info: RateLimitInfo) => void;
  skip?: (req: Request) => boolean;
  skipSuccessfulRequests?: boolean;
  headers?: boolean;
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetAt: number;
}

function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests',
    keyGenerator = (req) => req.ip || 'unknown',
    handler,
    skip = () => false,
    skipSuccessfulRequests = false,
    headers = true,
  } = options;

  // Use sliding window counter
  const windows = new Map<string, { prev: number; current: number; start: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    let window = windows.get(key);
    if (!window || window.start < windowStart) {
      window = { prev: window?.current || 0, current: 0, start: windowStart };
    }

    // Calculate weighted count
    const elapsed = now - window.start;
    const weight = elapsed / windowMs;
    const estimated = Math.ceil(window.prev * (1 - weight) + window.current);

    const info: RateLimitInfo = {
      limit: max,
      current: estimated,
      remaining: Math.max(0, max - estimated - 1),
      resetAt: window.start + windowMs,
    };

    // Set headers
    if (headers) {
      res.setHeader('X-RateLimit-Limit', info.limit);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetAt / 1000));
    }

    if (estimated >= max) {
      const retryAfter = Math.ceil((window.start + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);

      if (handler) {
        return handler(req, res, next, info);
      }

      return res.status(429).json({
        error: message,
        retryAfter,
      });
    }

    window.current++;
    windows.set(key, window);

    // Track successful requests if needed
    if (skipSuccessfulRequests) {
      const originalEnd = res.end.bind(res);
      res.end = function (...args: any[]) {
        if (res.statusCode < 400) {
          window!.current--;
        }
        return originalEnd(...args);
      } as any;
    }

    next();
  };
}

// Usage
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
}));

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                    // 5 login attempts per 15 minutes
  message: 'Too many login attempts',
  keyGenerator: (req) => `${req.ip}:${req.body.username || 'unknown'}`,
}));
```

### Redis-Based Distributed Rate Limiter

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function distributedRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const redisKey = `ratelimit:${key}:${windowStart}`;

  // Use Redis pipeline for atomic operations
  const pipeline = redis.pipeline();
  pipeline.incr(redisKey);
  pipeline.pexpire(redisKey, windowMs);
  
  const results = await pipeline.exec();
  const count = results![0][1] as number;

  const remaining = Math.max(0, maxRequests - count);
  const resetAt = windowStart + windowMs;

  return {
    allowed: count <= maxRequests,
    remaining,
    resetAt,
  };
}

// Distributed rate limit middleware
function distributedRateLimitMiddleware(
  maxRequests: number,
  windowMs: number,
  keyGenerator: (req: Request) => string = (req) => req.ip || 'unknown'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const result = await distributedRateLimit(key, maxRequests, windowMs);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter,
      });
    }

    next();
  };
}
```

### Sliding Window with Redis (More Accurate)

```typescript
async function slidingWindowRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${key}`;

  // Use Redis sorted set for precise sliding window
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart); // Remove old entries
  pipeline.zadd(redisKey, now.toString(), `${now}:${crypto.randomUUID()}`);
  pipeline.zcard(redisKey);
  pipeline.pexpire(redisKey, windowMs);

  const results = await pipeline.exec();
  const count = results![2][1] as number;

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
  };
}
```

---

## Rate Limiting Strategies

### Per-IP Rate Limiting

```typescript
// Basic per-IP limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip,
}));

// Handle proxy headers correctly
app.set('trust proxy', 1); // Trust first proxy

// Use X-Forwarded-For with validation
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    // Take the first (client) IP
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}
```

### Per-User Rate Limiting

```typescript
// Authenticated users get higher limits
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Default for unauthenticated
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.user?.role === 'admin', // Admins bypass
}));

// Different limits by subscription tier
const tierLimits = {
  free: { max: 100, windowMs: 60000 },
  pro: { max: 1000, windowMs: 60000 },
  enterprise: { max: 10000, windowMs: 60000 },
};

app.use('/api/', (req, res, next) => {
  const tier = req.user?.subscription || 'free';
  const limits = tierLimits[tier];
  
  return rateLimit({
    ...limits,
    keyGenerator: (req) => req.user?.id || req.ip,
  })(req, res, next);
});
```

### Per-Endpoint Rate Limiting

```typescript
// Different limits for different endpoints
const endpointLimits = {
  'POST /api/auth/login': { max: 5, windowMs: 900000 },      // 5 per 15 min
  'POST /api/auth/register': { max: 3, windowMs: 3600000 },  // 3 per hour
  'POST /api/messages': { max: 30, windowMs: 60000 },        // 30 per minute
  'GET /api/search': { max: 20, windowMs: 60000 },           // 20 per minute
  'POST /api/upload': { max: 10, windowMs: 60000 },          // 10 per minute
};

app.use('/api/', (req, res, next) => {
  const endpoint = `${req.method} ${req.path}`;
  const limits = endpointLimits[endpoint];
  
  if (limits) {
    return rateLimit(limits)(req, res, next);
  }
  
  // Default limit
  return rateLimit({ max: 100, windowMs: 60000 })(req, res, next);
});
```

### Role-Based Rate Limiting

```typescript
function roleBasedRateLimit(req: Request): RateLimitOptions {
  const role = req.user?.role || 'anonymous';
  
  const roleLimits = {
    anonymous: { max: 20, windowMs: 60000 },
    user: { max: 100, windowMs: 60000 },
    editor: { max: 500, windowMs: 60000 },
    admin: { max: 2000, windowMs: 60000 },
    superadmin: { max: 10000, windowMs: 60000 },
  };
  
  return {
    ...roleLimits[role] || roleLimits.anonymous,
    keyGenerator: (req) => req.user?.id || req.ip,
  };
}
```

---

## Advanced Patterns

### Graduated Rate Limiting (429 with Retry-After)

```typescript
async function graduatedRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.user?.id || req.ip;
  const { allowed, remaining } = await slidingWindowRateLimit(key, 100, 60000);

  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', remaining.toString());

  if (!allowed) {
    // Calculate progressive delay
    const violations = await getViolationCount(key);
    const delay = Math.min(violations * 1000, 30000); // Max 30 second delay
    
    res.setHeader('Retry-After', Math.ceil(delay / 1000));
    res.setHeader('X-RateLimit-Delay', delay.toString());
    
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(delay / 1000),
      message: `Please wait ${Math.ceil(delay / 1000)} seconds before retrying`,
    });
  }

  next();
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = new Map<string, number>();
  private lastFailure = new Map<string, number>();
  private state = new Map<string, 'closed' | 'open' | 'half-open'>();

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentState = this.state.get(key) || 'closed';

    if (currentState === 'open') {
      const lastFail = this.lastFailure.get(key) || 0;
      if (Date.now() - lastFail > this.resetTimeout) {
        this.state.set(key, 'half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      // Success - reset state
      this.failures.set(key, 0);
      this.state.set(key, 'closed');
      
      return result;
    } catch (error) {
      // Failure - increment counter
      const failures = (this.failures.get(key) || 0) + 1;
      this.failures.set(key, failures);
      this.lastFailure.set(key, Date.now());

      if (failures >= this.failureThreshold) {
        this.state.set(key, 'open');
      }

      throw error;
    }
  }
}
```

### Burst Protection

```typescript
// Allow small bursts but enforce sustained rate
async function burstProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.user?.id || req.ip;
  
  // Short window for burst detection (10 seconds)
  const burstLimit = await distributedRateLimit(`burst:${key}`, 10, 10000);
  
  // Long window for sustained rate (1 minute)
  const sustainedLimit = await distributedRateLimit(`sustained:${key}`, 60, 60000);

  res.setHeader('X-RateLimit-Burst-Remaining', burstLimit.remaining.toString());
  res.setHeader('X-RateLimit-Sustained-Remaining', sustainedLimit.remaining.toString());

  if (!burstLimit.allowed) {
    return res.status(429).json({
      error: 'Burst limit exceeded',
      type: 'burst',
      retryAfter: 10,
    });
  }

  if (!sustainedLimit.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      type: 'sustained',
      retryAfter: 60,
    });
  }

  next();
}
```

---

## Response Headers

### Standard Rate Limit Headers

```typescript
// Always include these headers
res.setHeader('X-RateLimit-Limit', maxRequests.toString());
res.setHeader('X-RateLimit-Remaining', remaining.toString());
res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());

// On 429 responses, include Retry-After
res.setHeader('Retry-After', retryAfterSeconds.toString());

// Optional: Include limit information
res.setHeader('X-RateLimit-Policy', `${maxRequests};w=${windowSeconds}`);
```

### Informative 429 Response

```typescript
function rateLimitExceeded(res: Response, info: RateLimitInfo) {
  const retryAfter = Math.ceil((info.resetAt - Date.now()) / 1000);
  
  res.status(429).json({
    error: 'Rate limit exceeded',
    message: `You have exceeded the ${info.limit} requests per minute limit.`,
    retryAfter,
    limit: info.limit,
    remaining: 0,
    resetAt: new Date(info.resetAt).toISOString(),
    documentation: 'https://api.example.com/docs/rate-limits',
  });
}
```

---

## Special Use Cases

### Login Rate Limiting (Per User + Per IP)

```typescript
async function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const { username, password } = req.body;
  const ip = req.ip;

  // Check IP-based limit
  const ipLimit = await slidingWindowRateLimit(`login:ip:${ip}`, 20, 900000);
  if (!ipLimit.allowed) {
    return res.status(429).json({
      error: 'Too many login attempts from this IP',
      retryAfter: 900,
    });
  }

  // Check username-based limit
  if (username) {
    const userLimit = await slidingWindowRateLimit(`login:user:${username}`, 5, 900000);
    if (!userLimit.allowed) {
      return res.status(429).json({
        error: 'Too many login attempts for this account',
        retryAfter: 900,
      });
    }
  }

  next();
}
```

### Search Rate Limiting

```typescript
// Prevent search abuse
app.get('/api/search', 
  rateLimit({
    max: 30,
    windowMs: 60000,
    keyGenerator: (req) => `${req.user?.id || req.ip}:search`,
  }),
  searchHandler
);

// Prevent expensive queries
async function searchRateLimit(req: Request, res: Response, next: NextFunction) {
  const query = req.query.q as string;
  
  // Rate limit by query complexity
  const complexity = calculateQueryComplexity(query);
  const maxRequests = Math.floor(100 / complexity); // More complex = fewer requests
  
  const key = `search:${req.user?.id || req.ip}`;
  const { allowed, remaining } = await slidingWindowRateLimit(key, maxRequests, 60000);

  if (!allowed) {
    return res.status(429).json({
      error: 'Search rate limit exceeded',
      message: 'Your search query is too complex for the current rate limit',
    });
  }

  next();
}
```

### API Key Rate Limiting

```typescript
// Per API key rate limiting
app.use('/api/', async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    const key = `apikey:${apiKey}`;
    const { allowed, remaining } = await slidingWindowRateLimit(key, 1000, 60000);
    
    res.setHeader('X-RateLimit-Limit', '1000');
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    
    if (!allowed) {
      return res.status(429).json({
        error: 'API key rate limit exceeded',
      });
    }
  }
  
  next();
});
```

---

## Monitoring and Alerting

```typescript
// Track rate limit hits
async function trackRateLimitHit(key: string, endpoint: string, exceeded: boolean) {
  await redis.hincrby(`ratelimit:stats:${endpoint}`, exceeded ? 'exceeded' : 'allowed', 1);
  
  if (exceeded) {
    // Alert on excessive rate limiting
    const exceededCount = await redis.hget(`ratelimit:stats:${endpoint}`, 'exceeded');
    if (parseInt(exceededCount || '0') > 100) {
      await alerting.send('Rate limit threshold exceeded', {
        endpoint,
        exceededCount: parseInt(exceededCount || '0'),
      });
    }
  }
}

// Dashboard metrics
app.get('/admin/rate-limit-stats', requireRole('admin'), async (req, res) => {
  const stats = {};
  const endpoints = await redis.keys('ratelimit:stats:*');
  
  for (const key of endpoints) {
    const endpoint = key.replace('ratelimit:stats:', '');
    const data = await redis.hgetall(key);
    stats[endpoint] = {
      allowed: parseInt(data.allowed || '0'),
      exceeded: parseInt(data.exceeded || '0'),
    };
  }
  
  res.json(stats);
});
```

---

## Testing Checklist

- [ ] Rate limits are enforced per IP
- [ ] Rate limits are enforced per user
- [ ] Rate limits are enforced per API key
- [ ] Response headers are included (X-RateLimit-*)
- [ ] 429 responses include Retry-After header
- [ ] Rate limits work across multiple servers (Redis)
- [ ] Admin users can bypass rate limits if configured
- [ ] Rate limits don't affect static assets
- [ ] Rate limits are configurable per endpoint
- [ ] Rate limit stats are being collected
- [ ] Alerting is configured for excessive rate limiting

---

## Common Mistakes to Avoid

1. **Using in-memory stores in production** - Won't work across multiple servers
2. **Not including retry-after information** - Clients don't know when to retry
3. **Rate limiting before authentication** - IP-based limits can be bypassed
4. **Not differentiating by user** - Legitimate heavy users get blocked
5. **Hardcoding limits** - Should be configurable per environment
6. **Not monitoring** - Can't improve what you don't measure
7. **Ignoring legitimate use cases** - Some endpoints need higher limits
8. **Not handling clock skew** - Distributed systems have time differences

---

## References

- Cloudflare Rate Limiting: https://www.cloudflare.com/learning/bots/what-is-rate-limiting/
- OWASP Rate Limiting Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Rate_Limiting_Cheat_Sheet.html
- Redis Rate Limiting Patterns: https://redis.io/docs/develop/patterns/rate-limiting/
- IETF Draft: RateLimit Header Fields for HTTP: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers
