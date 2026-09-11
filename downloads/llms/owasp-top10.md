# OWASP Top 10 Web Application Security Risks (2025)

> Reference compiled from OWASP Top 10 project. Source: https://owasp.org/Top10/

## Overview

The OWASP Top 10 is a standard awareness document for web application security. It represents a broad consensus about the most critical security risks to web applications. Updated for 2025, these categories help developers prioritize security efforts.

---

## A01: Broken Access Control

**Description:** Restrictions on what authenticated users are allowed to do are not properly enforced. Attackers can exploit flaws to access unauthorized functionality or data.

**Common Vulnerabilities:**
- Violation of the principle of least privilege
- Bypassing access control checks by modifying the URL, API requests, or HTML page
- Viewing or editing someone else's account by providing its unique identifier
- Accessing API with missing access controls for POST, PUT, and DELETE
- Elevation of privilege (acting as admin when logged in as user)
- Metadata manipulation (replaying/tampering with JWT tokens, cookies)
- CORS misconfiguration allowing API access from unauthorized origins

**Prevention Patterns:**

```typescript
// 1. Server-side access control enforcement
async function getResource(req: Request, res: Response) {
  const resourceId = req.params.id;
  const resource = await db.getResource(resourceId);

  if (!resource) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Always verify ownership on the server side
  if (resource.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json(resource);
}

// 2. Role-based middleware
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage
router.delete('/admin/users/:id', 
  authenticate, 
  requireRole('admin'), 
  deleteUser
);

// 3. IDOR prevention with resource-level authorization
async function updateOrder(req: Request, res: Response) {
  const order = await db.orders.findById(req.params.id);
  
  // Verify the authenticated user owns this order
  if (!order || order.organizationId !== req.user.organizationId) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Only allow updating certain fields based on role
  const allowedFields = req.user.role === 'admin' 
    ? ['status', 'notes', 'priority'] 
    : ['notes'];

  const updates = pick(req.body, allowedFields);
  await db.orders.update(order.id, updates);
  
  return res.json({ success: true });
}
```

**Testing Checklist:**
- [ ] Test all endpoints with different user roles
- [ ] Verify IDOR by modifying resource IDs in requests
- [ ] Check CORS configuration does not allow wildcard origins
- [ ] Validate JWT token cannot be tampered with to gain privileges

---

## A02: Cryptographic Failures

**Description:** Failures related to cryptography which often leads to exposure of sensitive data (passwords, credit cards, health records, personal information).

**Common Vulnerabilities:**
- Data transmitted in clear text (HTTP, FTP, SMTP)
- Weak or deprecated cryptographic algorithms (MD5, SHA1, DES)
- Default crypto keys in use
- Missing or weak crypto key management
- Missing certificate validation

**Prevention Patterns:**

```typescript
import crypto from 'crypto';

// 1. Never store passwords in plaintext - use bcrypt/scrypt/argon2
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 2. Encrypt sensitive data at rest using AES-256-GCM
function encrypt(plaintext: string, secretKey: string): { iv: string; tag: string; encrypted: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(secretKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return { iv: iv.toString('hex'), tag, encrypted };
}

function decrypt(ivHex: string, tagHex: string, encryptedHex: string, secretKey: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = Buffer.from(secretKey, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// 3. Use TLS everywhere - enforce HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// 4. Set secure headers
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Testing Checklist:**
- [ ] Verify all data in transit is encrypted (TLS 1.2+)
- [ ] Check no sensitive data in URL parameters
- [ ] Verify password hashing uses bcrypt/scrypt/argon2
- [ ] Confirm no deprecated algorithms (MD5, SHA1, DES, RC4)
- [ ] Validate certificate chain is properly configured

---

## A03: Injection

**Description:** Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query (SQL, NoSQL, OS command, LDAP, XPath, etc.).

**Common Vulnerabilities:**
- SQL injection
- NoSQL injection
- OS command injection
- LDAP injection
- Cross-site scripting (XSS) - often categorized separately

**Prevention Patterns:**

```typescript
// 1. Parameterized queries (SQL injection prevention)
// BAD - string concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD - parameterized query
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// 2. ORM usage (Prisma example)
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// 3. Input validation with Zod
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s'-]+$/),
  age: z.number().int().min(0).max(150),
});

app.post('/users', async (req, res) => {
  const validated = CreateUserSchema.parse(req.body); // throws on invalid
  const user = await db.users.create({ data: validated });
  return res.json(user);
});

// 4. Sanitize output for XSS prevention
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  });
}

// 5. NoSQL injection prevention (MongoDB)
// BAD
const user = await User.findOne({ username: req.body.username });

// GOOD - validate input types
if (typeof req.body.username !== 'string') {
  return res.status(400).json({ error: 'Invalid input' });
}
const user = await User.findOne({ username: req.body.username });
```

**Testing Checklist:**
- [ ] Test all input fields with SQL injection payloads (`' OR 1=1--`, etc.)
- [ ] Validate all user inputs with strict schema validation
- [ ] Test NoSQL injection with MongoDB operators (`$gt`, `$ne`, `$regex`)
- [ ] Check for command injection in any exec/system calls

---

## A04: Insecure Design

**Description:** Risks related to design flaws, missing or ineffective security controls. This is different from implementation vulnerabilities - insecure design cannot be fixed by a perfect implementation.

**Common Vulnerabilities:**
- Missing threat modeling
- Missing rate limiting on critical functions
- Missing security architecture patterns
- Insecure design patterns
- Missing or ineffective controls for privilege separation

**Prevention Patterns:**

```typescript
// 1. Threat modeling - identify assets, trust boundaries, and threats
// Design phase checklist:
// - What are the entry points?
// - What data is being processed?
// - What trust boundaries exist?
// - What are the threat actors?

// 2. Secure design patterns - separation of concerns
// BAD: Single endpoint handling everything
app.post('/admin/:action', handleAdminAction);

// GOOD: Specific endpoints with specific permissions
router.post('/admin/users', authenticate, requireRole('admin'), createUser);
router.delete('/admin/users/:id', authenticate, requireRole('admin'), deleteUser);
router.post('/admin/reports', authenticate, requireRole('admin'), generateReport);

// 3. Defense in depth
// Layer 1: Input validation
// Layer 2: Authentication
// Layer 3: Authorization
// Layer 4: Business logic validation
// Layer 5: Error handling (don't leak internals)

// 4. Secure defaults
const defaultConfig = {
  allowPublicRegistration: false,
  requireEmailVerification: true,
  passwordMinLength: 12,
  sessionTimeout: 3600,
  maxLoginAttempts: 5,
  lockoutDuration: 900, // 15 minutes
};
```

**Testing Checklist:**
- [ ] Document threat model for each feature
- [ ] Verify defense-in-depth at each layer
- [ ] Check secure defaults are enforced
- [ ] Validate business logic cannot be abused

---

## A05: Security Misconfiguration

**Description:** Missing appropriate security hardening across any part of the application stack, improperly configured permissions, or unnecessary features enabled.

**Common Vulnerabilities:**
- Missing appropriate security hardening
- Improperly configured permissions on cloud services
- Unnecessary features enabled
- Default accounts and passwords still enabled
- Error handling reveals stack traces
- Latest security features disabled

**Prevention Patterns:**

```typescript
// 1. Security headers configuration
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// 2. Disable X-Powered-By
app.disable('x-powered-by');

// 3. Production error handling - never leak internals
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Internal error:', err); // Log server-side
  
  // Generic error message to client
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id, // For correlation
  });
});

// 4. Environment-specific configurations
const config = {
  development: {
    debug: true,
    logging: 'verbose',
    cors: { origin: '*' },
  },
  production: {
    debug: false,
    logging: 'error',
    cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') },
  },
};

// 5. Disable directory listing
app.use(express.static('public', { dotfiles: 'deny' }));
```

**Testing Checklist:**
- [ ] Verify no default credentials in production
- [ ] Check error pages don't reveal stack traces
- [ ] Validate security headers are set correctly
- [ ] Confirm unnecessary ports/services are disabled

---

## A06: Vulnerable and Outdated Components

**Description:** Using components (libraries, frameworks, dependencies) with known vulnerabilities, unsupported versions, or not scanning for them regularly.

**Prevention Patterns:**

```bash
# 1. Regular dependency scanning
npm audit
pnpm audit

# 2. Use automated tools
npx better-npm-audit audit
npx snyk test

# 3. Keep dependencies updated
pnpm update
pnpm outdated

# 4. Use lockfiles and pin versions
# package-lock.json or pnpm-lock.yaml should be committed

# 5. Add to CI/CD pipeline
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm audit --audit-level=high
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

**Testing Checklist:**
- [ ] Run `npm audit` / `pnpm audit` regularly
- [ ] Monitor for CVEs in dependencies (Dependabot, Renovate)
- [ ] Remove unused dependencies
- [ ] Pin dependency versions in lockfile

---

## A07: Identification and Authentication Failures

**Description:** Confirmation of the user's identity, authentication, and session management is critical to protect against authentication-related attacks.

**Common Vulnerabilities:**
- Permitting automated attacks (credential stuffing)
- Permitting brute force or other automated attacks
- Permitting weak passwords
- Missing or ineffective multi-factor authentication
- Exposing session identifiers in the URL
- Not properly invalidating sessions on logout

**Prevention Patterns:**

```typescript
// 1. Strong password requirements
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

// 2. Account lockout after failed attempts
const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();

async function login(email: string, password: string) {
  const key = email.toLowerCase();
  const attempts = loginAttempts.get(key) || { count: 0 };
  
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    const waitMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    throw new Error(`Account locked. Try again in ${waitMinutes} minutes.`);
  }

  const user = await db.users.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    attempts.count++;
    if (attempts.count >= 5) {
      attempts.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
    }
    loginAttempts.set(key, attempts);
    throw new Error('Invalid credentials');
  }

  // Reset on success
  loginAttempts.delete(key);
  return createSession(user);
}

// 3. Secure session management
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 3600000, // 1 hour
  },
};

// 4. MFA support
import { authenticator } from 'otplib';

function setupMFA(userId: string) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(userId, 'MyApp', secret);
  
  // Store secret encrypted, return QR code URL
  return { secret: encrypt(secret), otpauthUrl };
}

function verifyMFA(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret: decrypt(secret) });
}
```

**Testing Checklist:**
- [ ] Verify password minimum length >= 12 characters
- [ ] Test account lockout after 5 failed attempts
- [ ] Verify session cookies are httpOnly, secure, sameSite
- [ ] Test MFA enrollment and verification flows

---

## A08: Software and Data Integrity Failures

**Description:** Failures relating to code and infrastructure that does not protect against integrity violations (e.g., insecure CI/CD pipelines, auto-update without verification).

**Common Vulnerabilities:**
- Insecure deserialization
- Software supply chain attacks
- CI/CD pipeline compromises
- Auto-update mechanisms without integrity checks

**Prevention Patterns:**

```typescript
// 1. Avoid insecure deserialization
// BAD - deserialize untrusted data
const data = JSON.parse(untrustedInput);

// GOOD - validate schema after parsing
const data = JSON.parse(untrustedInput);
const validated = MySchema.parse(data); // Zod validation

// 2. Subresource Integrity for CDN resources
// <script src="https://cdn.example.com/lib.js" 
//   integrity="sha384-..." 
//   crossorigin="anonymous"></script>

// 3. Package integrity checks
// Use npm's built-in checksums
// Verify lockfile matches package.json

// 4. Code signing for CI/CD
// Use signed commits and verified publishers
```

**Testing Checklist:**
- [ ] Verify no insecure deserialization of untrusted data
- [ ] Check SRI hashes on external scripts
- [ ] Validate CI/CD pipeline integrity
- [ ] Confirm dependency signatures match expected publishers

---

## A09: Security Logging and Monitoring Failures

**Description:** Insufficient logging, detection, monitoring, and active response allows attackers to further attack systems, maintain persistence, and tamper with data.

**Prevention Patterns:**

```typescript
import winston from 'winston';

// 1. Structured logging for security events
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'auth-service' },
  transports: [
    new winston.transports.File({ filename: 'security-audit.log' }),
  ],
});

// 2. Log security-relevant events
function logSecurityEvent(event: string, details: Record<string, unknown>) {
  securityLogger.info(event, {
    timestamp: new Date().toISOString(),
    ...details,
    // Never log passwords or tokens
    password: undefined,
    token: undefined,
  });
}

// Usage
logSecurityEvent('LOGIN_FAILED', { 
  userId: email, 
  ip: req.ip, 
  userAgent: req.headers['user-agent'],
  reason: 'invalid_password'
});

logSecurityEvent('PERMISSION_DENIED', {
  userId: req.user.id,
  resource: req.path,
  method: req.method,
});

logSecurityEvent('SENSITIVE_DATA_ACCESS', {
  userId: req.user.id,
  resourceType: 'user_pii',
  resourceId: targetUserId,
});

// 3. Alerting thresholds
const ALERT_THRESHOLDS = {
  failedLogins: { count: 10, window: 300 },  // 10 in 5 minutes
  permissionDenied: { count: 5, window: 60 }, // 5 in 1 minute
  dataExport: { count: 3, window: 3600 },      // 3 in 1 hour
};
```

**Testing Checklist:**
- [ ] Verify all authentication events are logged
- [ ] Check logs don't contain sensitive data (passwords, tokens)
- [ ] Validate alerting is configured for critical events
- [ ] Test log integrity (append-only, tamper-evident)

---

## A10: Server-Side Request Forgery (SSRF)

**Description:** SSRF flaws occur when a web application fetches a remote resource without validating the user-supplied URL, allowing an attacker to coerce the application to send crafted requests to unexpected destinations.

**Prevention Patterns:**

```typescript
import { URL } from 'url';
import ipaddr from 'ipaddr.js';

// 1. URL validation and allowlisting
function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Only allow specific protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    
    // Block internal/private IPs
    const hostname = url.hostname;
    if (isPrivateIP(hostname)) {
      return false;
    }
    
    // Allowlist specific domains
    const ALLOWED_HOSTS = ['api.example.com', 'cdn.example.com'];
    if (!ALLOWED_HOSTS.includes(hostname)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

function isPrivateIP(hostname: string): boolean {
  try {
    const addr = ipaddr.parse(hostname);
    return addr.range() === 'private' || 
           addr.range() === 'loopback' ||
           addr.range() === 'linkLocal';
  } catch {
    // If it's a domain name, resolve and check
    return false;
  }
}

// 2. Use a dedicated service for external requests
async function fetchExternalResource(url: string): Promise<string> {
  if (!isAllowedUrl(url)) {
    throw new Error('URL not allowed');
  }
  
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000), // Timeout
    redirect: 'error', // Don't follow redirects
  });
  
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }
  
  return response.text();
}

// 3. Network-level protections
// Deploy in a DMZ or use network policies to restrict outbound traffic
// Block access to cloud metadata endpoints (169.254.169.254)
```

**Testing Checklist:**
- [ ] Test with internal IP addresses (127.0.0.1, 10.x.x.x, 169.254.169.254)
- [ ] Try using different protocols (file://, gopher://, dict://)
- [ ] Verify DNS rebinding protection
- [ ] Check network-level restrictions on outbound traffic

---

## Quick Reference: Security Headers

```typescript
// Complete security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
  frameguard: { action: 'deny' },
}));
```

---

## References

- OWASP Top 10 (2025): https://owasp.org/Top10/
- OWASP API Security Top 10 (2023): https://owasp.org/www-project-api-security/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
