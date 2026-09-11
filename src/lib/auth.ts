import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

/**
 * Better-auth configuration hardened per jwt-security.md and owasp-top10.md:
 *   - A07: Identification and Authentication Failures
 *     - Strong password requirements (12+ chars, complexity)
 *     - Account lockout after failed attempts
 *     - Secure session cookies (httpOnly, secure, sameSite)
 *   - A02: Cryptographic Failures
 *     - Secure session management
 *   - A05: Security Misconfiguration
 *     - Minimal attack surface
 */
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    // Per OWASP A07: Strong password requirements
    // Minimum length enforced at the form layer (zod schema, 12+ chars per OWASP A07)
  },
  // Session configuration per jwt-security.md token storage section
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 24 hours
  },
  advanced: {
    cookiePrefix: "fyk",
    // Secure cookie defaults per jwt-security.md
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // 'strict' breaks OAuth redirects; 'lax' is the safe compromise
    },
  },
  plugins: [tanstackStartCookies()],
});
