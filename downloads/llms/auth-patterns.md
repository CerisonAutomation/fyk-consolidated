# Supabase Auth Patterns

> Practical implementation patterns for Supabase Auth: session management, OAuth, MFA, and security best practices.
> Sources: supabase.com/docs/guides/auth/sessions, supabase.com/docs/guides/auth, community guides.

---

## Overview

Supabase Auth provides complete authentication and authorization with:
- Email/password authentication
- OAuth providers (Google, GitHub, etc.)
- Magic links
- Phone/SMS authentication
- Multi-factor authentication (MFA)
- Session management with JWTs

**Key concepts:**
- **Access token (JWT)**: Short-lived (5 min - 1 hour), contains user claims
- **Refresh token**: Long-lived, single-use, exchanges for new token pair
- **Session**: Created on sign-in, represented by access + refresh token pair

---

## 1. Session Management

### Session Lifecycle

```
Sign In -> Access Token + Refresh Token
    |
    v
Access Token Expires -> Refresh Token exchanges for new pair
    |
    v
User Signs Out -> Session destroyed, refresh tokens revoked
```

### Session Structure

```typescript
interface Session {
  access_token: string   // JWT, short-lived (5min - 1hr)
  refresh_token: string  // Single-use string, long-lived
  expires_in: number     // Seconds until access_token expires
  expires_at: number     // Unix timestamp
  token_type: string     // "bearer"
  user: User             // User object
}
```

### Listen to Auth State Changes

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event)
  // Events: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY

  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session?.user.email)
  }
  if (event === 'SIGNED_OUT') {
    console.log('User signed out')
    // Redirect to login
  }
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed')
  }
})
```

### Get Current Session

```typescript
const { data: { session }, error } = await supabase.auth.getSession()

if (session) {
  console.log('User:', session.user.email)
  console.log('Expires at:', new Date(session.expires_at! * 1000))
} else {
  // No active session, redirect to login
}
```

### Get Current User

```typescript
const { data: { user }, error } = await supabase.auth.getUser()

if (user) {
  console.log('User ID:', user.id)
  console.log('Email:', user.email)
  console.log('User metadata:', user.user_metadata)
}
```

---

## 2. Authentication Methods

### Email/Password Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword123',
  options: {
    data: {
      // Custom user metadata
      full_name: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg',
    },
  },
})

if (error) {
  console.error('Sign up error:', error.message)
} else {
  // Check if email confirmation is required
  if (data.user?.identities?.length === 0) {
    console.log('Email already registered')
  }
}
```

### Email/Password Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword123',
})

if (error) {
  console.error('Sign in error:', error.message)
} else {
  console.log('Signed in:', data.user.email)
}
```

### Magic Link (Passwordless)

```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: 'https://yourapp.com/callback',
  },
})
```

### OAuth Sign In

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://yourapp.com/callback',
    scopes: 'openid profile email',
  },
})

// For GitHub
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: 'https://yourapp.com/callback',
  },
})
```

---

## 3. Token Refresh Patterns

### Automatic Token Refresh

```typescript
// Supabase client handles token refresh automatically
// But you can listen for refresh events:
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed at:', new Date())
  }
})
```

### Manual Token Refresh

```typescript
const { data, error } = await supabase.auth.refreshSession()

if (error) {
  console.error('Refresh failed:', error.message)
  // Force re-login
  await supabase.auth.signOut()
}
```

### Refresh Token Reuse Detection

Supabase has built-in protection against refresh token theft:

1. **Reuse interval**: A refresh token can be used more than once within 10 seconds (for SSR scenarios)
2. **Parent token reuse**: If the parent of the current active token is used, the active token is returned
3. **Theft detection**: If a stolen token is used outside these exceptions, the entire session is terminated

```typescript
// This is handled automatically by the client
// If you detect suspicious activity, you can sign out:
await supabase.auth.signOut()
```

---

## 4. Multi-Factor Authentication (MFA)

### Enroll TOTP MFA

```typescript
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'Authenticator App',
})

// data.totp.qr_code contains the QR code URL
// data.totp.secret contains the secret (for manual entry)
```

### Verify TOTP MFA

```typescript
const { data, error } = await supabase.auth.mfa.verify({
  factorId: 'factor-id-from-enroll',
  code: '123456', // 6-digit code from authenticator
  challengeId: 'challenge-id',
})

if (data.session) {
  console.log('MFA verified, session upgraded')
}
```

### Check MFA Status

```typescript
const { data: factors, error } = await supabase.auth.mfa.list()

if (factors.totp.length > 0) {
  console.log('User has TOTP MFA enabled')
}

// Check AAL level
const { data: { currentLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

if (currentLevel === 'aal1') {
  // User needs to complete MFA
  router.push('/mfa-verify')
} else if (currentLevel === 'aal2') {
  // User has completed MFA
}
```

---

## 5. Session Security Best Practices

### JWT Expiration Configuration

```typescript
// Recommended settings (configured in Dashboard > Auth > Sessions)
// - Access token lifetime: 1 hour (default)
// - Never set below 5 minutes (causes clock sync issues)
// - Never set below 2 minutes (breaks client refresh)
```

### Single Session Per User

```sql
-- Enable single session per user (Pro plan and up)
-- Configured in Dashboard > Auth > Sessions > Single session per user
-- When enabled, only the most recently active session remains
```

### Time-Boxed Sessions

```typescript
// Configure in Dashboard > Auth > Sessions
// - Time-box user sessions: terminate after fixed time
// - Inactivity timeout: terminate after period of inactivity

// Check session expiry
const { data: { session } } = await supabase.auth.getSession()

if (session) {
  const expiresAt = new Date(session.expires_at! * 1000)
  const now = new Date()

  if (expiresAt < now) {
    // Session expired, need to refresh
    const { error } = await supabase.auth.refreshSession()
    if (error) {
      // Refresh failed, redirect to login
      window.location.href = '/login'
    }
  }
}
```

---

## 6. Server-Side Auth (SSR)

### Next.js App Router

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

### Middleware Protection

```typescript
// middleware.ts
import { createClient } from '@/utils/supabase/middleware'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const supabase = createClient(request)

  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### HTTP-Only Cookies for SSR

```typescript
// For traditional server-rendered apps
// Store tokens in HTTP-only cookies for maximum security

import { createServerClient } from '@supabase/ssr'

export function createClient(request, response) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}
```

---

## 7. Sign Out Patterns

### Basic Sign Out

```typescript
const { error } = await supabase.auth.signOut()

if (error) {
  console.error('Sign out error:', error.message)
}
```

### Sign Out with Scope

```typescript
// Sign out from all sessions (global)
const { error } = await supabase.auth.signOut({ scope: 'global' })

// Sign out from current session only
const { error } = await supabase.auth.signOut({ scope: 'local' })
```

### Sign Out Cleanup

```typescript
async function handleSignOut() {
  // Clear any app state
  clearUserState()

  // Sign out from Supabase
  const { error } = await supabase.auth.signOut()

  // Clear local storage
  localStorage.clear()

  // Redirect to login
  window.location.href = '/login'
}
```

---

## 8. Custom Claims and User Metadata

### Set User Metadata

```typescript
const { data, error } = await supabase.auth.updateUser({
  data: {
    full_name: 'John Doe',
    avatar_url: 'https://example.com/avatar.jpg',
    role: 'admin',
    preferences: {
      theme: 'dark',
      language: 'en',
    },
  },
})
```

### Access User Metadata

```typescript
const { data: { user } } = await supabase.auth.getUser()

// Access metadata
console.log(user.user_metadata.full_name)
console.log(user.user_metadata.role)

// Access app-specific metadata (set by admin)
console.log(user.app_metadata.role)
```

### Custom JWT Claims (RLS Integration)

```sql
-- Create a function to add custom claims to JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  -- Get user role from your table
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  -- Add custom claims
  claims := event->'claims';
  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'user')));

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql;

-- Enable the hook
ALTER TABLE auth.users
  SET (auth.jwt()
    = jsonb_build_object(
      'role', 'authenticated',
      'aud', 'authenticated',
      'exp', extract(epoch from now() + interval '1 hour')::integer,
      'sub', id,
      'email', email,
      'app_metadata', app_metadata,
      'user_metadata', user_metadata,
      'role', COALESCE(user_role, 'authenticated')
    ));
```

---

## 9. Error Handling

### Common Auth Errors

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'wrongpassword',
})

switch (error?.message) {
  case 'Invalid login credentials':
    // Wrong email or password
    break
  case 'Email not confirmed':
    // User hasn't confirmed their email
    break
  case 'Too many requests':
    // Rate limited
    break
  case 'User not found':
    // No user with this email
    break
  default:
    console.error('Auth error:', error?.message)
}
```

### Retry Logic

```typescript
async function signInWithRetry(email: string, password: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!error) return { data, error: null }

    if (error.message === 'Too many requests') {
      await new Promise(r => setTimeout(r, 1000 * (i + 1))) // Exponential backoff
      continue
    }

    return { data, error } // Non-retryable error
  }

  return { data: null, error: { message: 'Max retries exceeded' } }
}
```

---

## 10. Security Best Practices

| Practice | Why |
|----------|-----|
| Use PKCE flow (default) | More secure than implicit flow |
| Never expose service_role key | Bypasses all RLS |
| Use HTTP-only cookies for SSR | Prevents XSS token theft |
| Enable MFA for sensitive apps | Additional security layer |
| Set appropriate JWT expiry | Balance security vs UX |
| Validate JWT on server | Defense in depth |
| Use RLS policies | Database-level authorization |
| Monitor auth logs | Detect suspicious activity |

### Security Checklist

1. Use HTTPS everywhere
2. Never store tokens in localStorage (use HTTP-only cookies for SSR)
3. Validate JWTs on the server side
4. Enable MFA for admin/sensitive operations
5. Set up rate limiting on auth endpoints
6. Monitor for unusual sign-in patterns
7. Use refresh token rotation (enabled by default)
8. Keep Supabase client library updated
9. Review and test RLS policies regularly
10. Use environment variables for all secrets

---

*References:*
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth
- https://deepwiki.com/supabase/auth-js/4-session-management
- https://deepwiki.com/supabase/auth/6-session-and-token-management
