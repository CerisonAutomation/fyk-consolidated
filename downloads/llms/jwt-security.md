# JWT Security Best Practices

> Reference compiled from OWASP, Auth0, and RFC 7519 documentation.

## Overview

JSON Web Tokens (JWTs) are a widely used standard for securely transmitting information between parties as a JSON object. When implemented correctly, JWTs provide a stateless authentication mechanism. However, improper implementation is one of the most common security vulnerabilities in modern web applications.

---

## JWT Structure

A JWT consists of three parts separated by dots: `header.payload.signature`

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

---

## Critical Security Rules

### 1. Always Validate the Algorithm

**Vulnerability:** Algorithm confusion attacks allow attackers to bypass signature verification.

```typescript
import jwt from 'jsonwebtoken';

// VULNERABLE - accepts any algorithm
jwt.verify(token, secret);

// SECURE - explicitly specify allowed algorithms
jwt.verify(token, secret, { algorithms: ['HS256'] });

// For asymmetric keys (RS256, ES256)
jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

### 2. Never Use `none` Algorithm

**Vulnerability:** The `none` algorithm disables signature verification entirely.

```typescript
// The server MUST reject tokens with alg: "none"
const decoded = jwt.decode(token, { complete: true });
if (decoded?.header.alg === 'none') {
  throw new Error('Invalid algorithm');
}

// Use a library that rejects 'none' by default
// jsonwebtoken rejects 'none' by default since v9
```

### 3. Use Strong Secrets/Keys

```typescript
// For HMAC algorithms (HS256, HS384, HS512)
// Generate a strong secret
import crypto from 'crypto';
const secret = crypto.randomBytes(64).toString('hex'); // 512-bit

// For RSA/EC algorithms (RS256, ES256)
// Generate key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// NEVER hardcode secrets in source code
// Use environment variables or a secrets manager
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### 4. Set Short Expiration Times

```typescript
// Access tokens: 15 minutes or less
const accessToken = jwt.sign(
  { userId: user.id, role: user.role },
  JWT_SECRET,
  { 
    expiresIn: '15m',      // Short-lived
    issuer: 'myapp',
    audience: 'myapp-api',
  }
);

// Refresh tokens: longer, but revocable
const refreshToken = jwt.sign(
  { userId: user.id, tokenId: crypto.randomUUID() },
  REFRESH_SECRET,
  {
    expiresIn: '7d',
    issuer: 'myapp',
    audience: 'myapp-api',
  }
);

// ID tokens (for OIDC): 1 hour
const idToken = jwt.sign(
  { sub: user.id, email: user.email, name: user.name },
  ID_TOKEN_SECRET,
  { expiresIn: '1h' }
);
```

### 5. Implement Token Revocation

```typescript
// JWTs are stateless, so revocation requires a store
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Token blacklist for logout/revocation
async function revokeToken(jti: string, exp: number): Promise<void> {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(`revoked:${jti}`, ttl, '1');
  }
}

async function isTokenRevoked(jti: string): Promise<boolean> {
  return (await redis.exists(`revoked:${jti}`)) === 1;
}

// Token refresh - invalidate old refresh token
async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const decoded = jwt.verify(refreshToken, REFRESH_SECRET, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;
  
  // Check if refresh token is revoked
  if (await isTokenRevoked(decoded.jti)) {
    throw new Error('Token revoked');
  }
  
  // Revoke the old refresh token (rotation)
  await revokeToken(decoded.jti, decoded.exp!);
  
  // Issue new tokens
  const user = await db.users.findById(decoded.userId);
  if (!user) throw new Error('User not found');
  
  return {
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user),
  };
}
```

### 6. Include Required Claims

```typescript
function createAccessToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,                    // Subject (required)
      iat: Math.floor(Date.now() / 1000), // Issued at
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
      iss: 'https://myapp.com',        // Issuer
      aud: 'https://api.myapp.com',    // Audience
      jti: crypto.randomUUID(),        // JWT ID (for revocation)
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}
```

### 7. Validate All Claims on Receipt

```typescript
function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'https://myapp.com',
    audience: 'https://api.myapp.com',
    clockTolerance: 30, // 30 seconds grace for clock skew
  }) as JwtPayload;
  
  // Additional validations
  if (!decoded.sub) throw new Error('Missing subject');
  if (!decoded.jti) throw new Error('Missing JWT ID');
  
  return decoded;
}

// Middleware
async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    
    // Check if revoked
    if (await isTokenRevoked(payload.jti!)) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

## Token Storage Best Practices

### Server-Side (Node.js)

```typescript
// HttpOnly cookies - prevents XSS from stealing tokens
res.cookie('accessToken', accessToken, {
  httpOnly: true,     // Not accessible via JavaScript
  secure: true,       // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 900000,     // 15 minutes
  path: '/api',
});

res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 604800000,  // 7 days
  path: '/api/auth',  // Only sent to auth endpoints
});
```

### Client-Side (Browser)

```typescript
// SPAs: Use BFF (Backend for Frontend) pattern
// Store tokens in httpOnly cookies, not localStorage

// For mobile apps: Use secure storage
// iOS: Keychain
// Android: EncryptedSharedPreferences

// NEVER store tokens in:
// - localStorage (accessible via XSS)
// - sessionStorage (accessible via XSS)
// - URL parameters (logged in server logs)
// - LocalStorage, IndexedDB without encryption
```

---

## Common Attack Vectors and Defenses

### 1. Algorithm Confusion Attack

```
Attack: Attacker changes header alg from RS256 to HS256
         and signs with the public key (which is often public)

Defense: Always verify the algorithm matches expected value
```

```typescript
// BAD
const decoded = jwt.decode(token, { complete: true });
const key = decoded.header.alg.startsWith('HS') ? secret : publicKey;
jwt.verify(token, key);

// GOOD
jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

### 2. Key Confusion Attack

```
Attack: For RSA, attacker uses public key as HMAC secret

Defense: Never mix symmetric and asymmetric algorithms
```

### 3. JWT Sidejacking

```
Attack: Intercepting JWT from network traffic

Defense: Always use HTTPS, set Secure flag on cookies
```

### 4. JWT Injection

```
Attack: Injecting claims via modified payload

Defense: Verify signature before processing any claims
```

---

## Complete Implementation Example

```typescript
// token-service.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const CONFIG = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET!,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET!,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'https://myapp.com',
  audience: 'https://api.myapp.com',
};

export class TokenService {
  // Generate token pair
  static generateTokenPair(user: { id: string; role: string }) {
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();
    
    const accessToken = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        jti: accessJti,
      },
      CONFIG.accessTokenSecret,
      {
        expiresIn: CONFIG.accessTokenExpiry,
        algorithm: 'HS256',
        issuer: CONFIG.issuer,
        audience: CONFIG.audience,
      }
    );
    
    const refreshToken = jwt.sign(
      {
        sub: user.id,
        jti: refreshJti,
      },
      CONFIG.refreshTokenSecret,
      {
        expiresIn: CONFIG.refreshTokenExpiry,
        algorithm: 'HS256',
        issuer: CONFIG.issuer,
        audience: CONFIG.audience,
      }
    );
    
    return { accessToken, refreshToken, accessJti, refreshJti };
  }
  
  // Verify access token
  static verifyAccessToken(token: string) {
    return jwt.verify(token, CONFIG.accessTokenSecret, {
      algorithms: ['HS256'],
      issuer: CONFIG.issuer,
      audience: CONFIG.audience,
    });
  }
  
  // Verify refresh token
  static async verifyRefreshToken(token: string) {
    const decoded = jwt.verify(token, CONFIG.refreshTokenSecret, {
      algorithms: ['HS256'],
      issuer: CONFIG.issuer,
      audience: CONFIG.audience,
    }) as jwt.JwtPayload;
    
    // Check revocation
    const revoked = await redis.get(`revoked:${decoded.jti}`);
    if (revoked) {
      throw new Error('Refresh token revoked');
    }
    
    return decoded;
  }
  
  // Revoke token
  static async revokeToken(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(`revoked:${jti}`, ttl, '1');
    }
  }
  
  // Revoke all user tokens (e.g., on password change)
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await redis.set(`revoked:user:${userId}`, '1', 'EX', 604800); // 7 days
  }
}
```

---

## Testing Checklist

- [ ] Tokens are rejected if algorithm doesn't match expected
- [ ] Tokens with `alg: "none"` are rejected
- [ ] Expired tokens are rejected
- [ ] Tokens with invalid signatures are rejected
- [ ] Tokens are revoked on logout
- [ ] Refresh token rotation works correctly
- [ ] Tokens from wrong issuer/audience are rejected
- [ ] Clock skew tolerance is reasonable (30s)
- [ ] Secrets are not hardcoded in source code
- [ ] Tokens are stored in httpOnly cookies, not localStorage

---

## References

- RFC 7519 - JSON Web Token: https://datatracker.ietf.org/doc/html/rfc7519
- OWASP JWT Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
- Auth0 JWT Best Practices: https://auth0.com/docs/secure/tokens/json-web-tokens
- JWT Debugger: https://jwt.io/
