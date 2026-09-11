# REST API Security Patterns

> Reference compiled from OWASP API Security Top 10 (2023) and industry best practices.
> Source: https://owasp.org/www-project-api-security/

## Overview

APIs expose application logic and sensitive data, making them prime targets for attackers. The OWASP API Security Top 10 (2023) identifies the most critical API-specific security risks.

---

## OWASP API Security Top 10 (2023)

| Rank | Category | Description |
|------|----------|-------------|
| API1 | Broken Object Level Authorization | Accessing objects via user-supplied IDs without authorization checks |
| API2 | Broken Authentication | Compromised authentication tokens or implementation flaws |
| API3 | Broken Object Property Level Authorization | Information exposure or manipulation at property level |
| API4 | Unrestricted Resource Consumption | No limits on request frequency, size, or resource usage |
| API5 | Broken Function Level Authorization | Accessing admin functions without proper role checks |
| API6 | Unrestricted Access to Sensitive Business Flows | Business logic abuse through automation |
| API7 | Server Side Request Forgery | Forging requests to internal services via user-supplied URLs |
| API8 | Security Misconfiguration | Missing hardening, unnecessary features, verbose errors |
| API9 | Improper Inventory Management | Exposed deprecated or undocumented endpoints |
| API10 | Unsafe Consumption of APIs | Trusting third-party API data without validation |

---

## Authentication Patterns

### API Key Authentication

```typescript
// Middleware for API key validation
function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Include X-API-Key header',
    });
  }
  
  // Validate against database (hashed storage)
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const validKey = await db.apiKeys.findByHash(keyHash);
  
  if (!validKey || validKey.revoked) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  if (validKey.expiresAt && validKey.expiresAt < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }
  
  // Check rate limits for this key
  req.apiKey = validKey;
  req.user = validKey.user;
  next();
}

// API Key storage (never store plaintext)
async function createApiKey(userId: string, name: string) {
  const rawKey = `ak_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  await db.apiKeys.create({
    userId,
    name,
    keyHash,
    prefix: rawKey.slice(0, 7), // 'ak_xxxx' for identification
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  });
  
  // Return raw key only once - user must store it
  return { apiKey: rawKey, prefix: rawKey.slice(0, 7) };
}
```

### OAuth 2.0 / OpenID Connect

```typescript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// Configure OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  // Find or create user
  let user = await db.users.findByGoogleId(profile.id);
  if (!user) {
    user = await db.users.create({
      googleId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
    });
  }
  return done(null, user);
}));

// OAuth callback handler
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Issue JWT after successful OAuth
    const tokens = TokenService.generateTokenPair(req.user);
    
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.redirect(`/dashboard?token=${tokens.accessToken}`);
  }
);
```

### Mutual TLS (mTLS)

```typescript
import https from 'https';
import fs from 'fs';

// Server configuration for mTLS
const serverOptions = {
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem'),
  ca: fs.readFileSync('ca-cert.pem'), // CA that signed client certs
  requestCert: true,       // Request client certificate
  rejectUnauthorized: true, // Reject connections without valid cert
};

// Extract client identity from certificate
function authenticateMtls(req: Request, res: Response, next: NextFunction) {
  const cert = req.socket.getPeerCertificate();
  
  if (!cert.subject) {
    return res.status(401).json({ error: 'Client certificate required' });
  }
  
  // Extract client ID from certificate CN or SAN
  const clientId = cert.subject.CN;
  const client = await db.clients.findByCertificate(clientId);
  
  if (!client) {
    return res.status(401).json({ error: 'Unknown client' });
  }
  
  req.client = client;
  next();
}
```

---

## Authorization Patterns

### Role-Based Access Control (RBAC)

```typescript
// Define roles and permissions
const ROLES = {
  viewer: ['read:own', 'read:public'],
  editor: ['read:own', 'read:public', 'write:own', 'write:public'],
  admin: ['read:any', 'write:any', 'delete:any', 'manage:users'],
  superadmin: ['*'], // All permissions
} as const;

type Role = keyof typeof ROLES;
type Permission = typeof ROLES[Role][number];

// Middleware
function requirePermission(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user.role as Role;
    const userPermissions = ROLES[userRole] || [];
    
    const hasPermission = permissions.every(p => 
      userPermissions.includes(p) || userPermissions.includes('*')
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        current: userPermissions,
      });
    }
    
    next();
  };
}

// Usage
router.get('/users/:id', 
  authenticate,
  requirePermission('read:any'),
  getUser
);

router.put('/users/:id',
  authenticate,
  requirePermission('write:any'),
  updateUser
);
```

### Attribute-Based Access Control (ABAC)

```typescript
// Policy evaluation
interface PolicyContext {
  user: {
    id: string;
    role: string;
    department: string;
  };
  resource: {
    type: string;
    ownerId: string;
    organizationId: string;
    classification: string;
  };
  action: string;
  environment: {
    time: Date;
    ip: string;
  };
}

function evaluatePolicy(ctx: PolicyContext): boolean {
  // Department-based access
  if (ctx.resource.classification === 'confidential' && 
      ctx.user.department !== 'engineering') {
    return false;
  }
  
  // Time-based access
  if (ctx.action === 'delete' && 
      ctx.environment.time.getHours() < 9) {
    return false; // No deletions before 9 AM
  }
  
  // Ownership check
  if (ctx.action.startsWith('write:') && 
      ctx.resource.ownerId !== ctx.user.id) {
    return false;
  }
  
  return true;
}

// Middleware
function authorize(resourceType: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const resource = await loadResource(req, resourceType);
    
    const context: PolicyContext = {
      user: req.user,
      resource,
      action,
      environment: {
        time: new Date(),
        ip: req.ip,
      },
    };
    
    if (!evaluatePolicy(context)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    req.resource = resource;
    next();
  };
}
```

---

## Input Validation

### Request Validation with Zod

```typescript
import { z } from 'zod';

// Reusable schemas
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('asc'),
});

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).optional(),
  price: z.number().positive().max(999999.99),
  category: z.enum(['electronics', 'clothing', 'books', 'other']),
  tags: z.array(z.string().max(50)).max(10).optional(),
  metadata: z.record(z.string(), z.string().max(200)).optional(),
});

const UpdateProductSchema = CreateProductSchema.partial();

// Validation middleware
function validate(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
}

// Usage
router.post('/products',
  authenticate,
  validate(CreateProductSchema),
  createProduct
);

router.get('/products',
  authenticate,
  validate(PaginationSchema, 'query'), // Validate query params
  listProducts
);
```

### Content-Type Validation

```typescript
function requireContentType(...types: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !types.some(t => contentType.includes(t))) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        supported: types,
      });
    }
    
    next();
  };
}

// Usage
router.post('/upload',
  authenticate,
  requireContentType('multipart/form-data'),
  uploadFile
);
```

---

## Rate Limiting and Quotas

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Global rate limit
const globalLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                 // 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000,
  max: 20,  // 20 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Rate limit by IP + username combination
    return `${req.ip}:${req.body.username || 'unknown'}`;
  },
});

// Per-user API quotas
async function checkApiQuota(req: Request, res: Response, next: NextFunction) {
  const userId = req.user.id;
  const quota = req.user.apiQuota || 10000; // requests per day
  
  const key = `quota:${userId}:${new Date().toISOString().split('T')[0]}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, 86400); // 24 hours
  }
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', quota);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, quota - current));
  res.setHeader('X-RateLimit-Reset', 
    Math.ceil(new Date().setHours(24, 0, 0, 0) / 1000)
  );
  
  if (current > quota) {
    return res.status(429).json({
      error: 'API quota exceeded',
      limit: quota,
      reset: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
    });
  }
  
  next();
}
```

---

## Request/Response Security

### Request Size Limits

```typescript
import express from 'express';

// Body size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Custom middleware for more granular control
function limitRequestBody(maxSizeBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize: `${maxSizeBytes / 1024 / 1024}MB`,
      });
    }
    
    next();
  };
}

// Different limits per endpoint
router.post('/upload', 
  limitRequestBody(10 * 1024 * 1024), // 10MB for uploads
  uploadHandler
);

router.post('/messages',
  limitRequestBody(64 * 1024), // 64KB for messages
  messageHandler
);
```

### Response Filtering

```typescript
// Never expose internal details
function sanitizeError(error: Error, req: Request) {
  // Log full error server-side
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    requestId: req.id,
    userId: req.user?.id,
  });
  
  // Return sanitized error to client
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    error: 'Internal server error',
    requestId: req.id,
    ...(isProduction ? {} : { 
      message: error.message,
      stack: error.stack,
    }),
  };
}

// Field filtering for responses
function filterResponse(data: any, allowedFields: string[]) {
  if (Array.isArray(data)) {
    return data.map(item => filterResponse(item, allowedFields));
  }
  
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => allowedFields.includes(key))
  );
}

// Usage
const publicUserFields = ['id', 'name', 'avatar'];
const privateUserFields = ['id', 'name', 'email', 'phone', 'address'];

router.get('/users/:id/public', (req, res) => {
  const user = filterResponse(req.user, publicUserFields);
  res.json(user);
});
```

---

## CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://myapp.com',
      'https://admin.myapp.com',
      'https://staging.myapp.com',
    ];
    
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit'],
  maxAge: 86400, // 24 hours preflight cache
};

app.use(cors(corsOptions));

// More restrictive CORS for sensitive endpoints
router.post('/admin/*',
  cors({
    origin: 'https://admin.myapp.com',
    methods: ['POST', 'PUT', 'DELETE'],
    credentials: true,
  }),
  adminHandler
);
```

---

## API Versioning and Deprecation

```typescript
// URL versioning
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Header versioning
function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  const version = req.headers['accept-version'] || '1';
  
  if (!['1', '2'].includes(version)) {
    return res.status(400).json({
      error: 'Unsupported API version',
      supported: ['1', '2'],
    });
  }
  
  req.apiVersion = parseInt(version);
  next();
}

// Deprecation headers
function deprecated(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', new Date('2025-01-01').toUTCString());
  res.setHeader('Link', '</api/v2>; rel="successor-version"');
  next();
}

// Usage
router.get('/old-endpoint', deprecated, oldHandler);
```

---

## Security Headers for APIs

```typescript
import helmet from 'helmet';

app.use(helmet({
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  
  // XSS protection
  xssFilter: true,
  
  // HSTS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
  
  // Referrer policy
  referrerPolicy: { policy: 'no-referrer' },
}));

// API-specific headers
app.use((req, res, next) => {
  // Prevent caching of sensitive responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  // Remove server identification
  res.removeHeader('X-Powered-By');
  
  next();
});
```

---

## Error Handling

```typescript
// Custom API error class
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Error handling middleware
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error
  console.error('API Error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method,
  });
  
  // Handle known errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id,
      },
    });
  }
  
  // Handle validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: (err as any).errors,
        requestId: req.id,
      },
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        requestId: req.id,
      },
    });
  }
  
  // Unknown error - don't leak details
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.id,
    },
  });
}

// Not found handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});
```

---

## Testing Checklist

### Authentication
- [ ] API keys are validated and checked for expiration
- [ ] OAuth tokens are verified correctly
- [ ] mTLS certificates are validated
- [ ] Invalid credentials return generic error messages

### Authorization
- [ ] RBAC policies are enforced for all endpoints
- [ ] Users can only access their own resources (IDOR prevention)
- [ ] Admin endpoints require admin role
- [ ] Cross-tenant access is blocked

### Input Validation
- [ ] All inputs are validated against schemas
- [ ] Request body size limits are enforced
- [ ] Content-Type is validated
- [ ] SQL/NoSQL injection payloads are rejected

### Rate Limiting
- [ ] Global rate limits are applied
- [ ] Per-endpoint limits are configured
- [ ] Rate limit headers are returned
- [ ] 429 responses include retry-after information

### Error Handling
- [ ] Stack traces are not exposed in production
- [ ] Error responses follow consistent format
- [ ] Sensitive data is not logged
- [ ] Request IDs are included for correlation

### CORS
- [ ] Only allowed origins can access the API
- [ ] Credentials are handled correctly
- [ ] Preflight requests are handled
- [ ] Methods and headers are restricted

---

## References

- OWASP API Security Top 10 (2023): https://owasp.org/www-project-api-security/
- OWASP API Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/API_Security_Cheat_Sheet.html
- REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OAuth 2.0 Security Best Current Practice: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics
