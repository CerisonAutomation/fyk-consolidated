import { createServer } from "vite";
import crypto from "crypto";

const server = await createServer({
  server: { port: 3000 },
  appType: "custom",
});

// ---------------------------------------------------------------------------
// Security headers middleware (replaces helmet for Vite dev server)
// Per OWASP Top 10 (A05: Security Misconfiguration) and CSP documentation.
// ---------------------------------------------------------------------------

function securityHeaders(req, res, next) {
  // 1. Content-Security-Policy (CSP) — prevents XSS, clickjacking, code injection
  //    Per csp-headers.md: strict policy with nonce for scripts.
  const nonce = crypto.randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;

  const isProduction = process.env.NODE_ENV === "production";

  const cspDirectives = [
    "default-src 'self'",
    // Scripts: self + nonce in prod; allow unsafe-inline in dev for HMR
    isProduction
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'unsafe-eval'`,
    // Styles: self + unsafe-inline (common for CSS-in-JS/Tailwind)
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Images: self, data URIs, HTTPS CDN (Pexels photos, Mapbox tiles)
    `img-src 'self' data: https: blob:`,
    // Connect: self + Supabase + Mapbox API + PostHog + Sentry
    `connect-src 'self' https://*.supabase.co https://api.mapbox.com https://*.posthog.com https://*.sentry.io wss://*.supabase.co`,
    // Fonts: self + Google Fonts
    `font-src 'self' https://fonts.gstatic.com data:`,
    // No plugins, no frames, no media (strict)
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'",
    // Security directives
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // CSP header
  res.setHeader("Content-Security-Policy", cspDirectives);

  // 2. HSTS — force HTTPS for 1 year with subdomains (OWASP A02)
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // 3. Prevent MIME type sniffing (OWASP A05)
  res.setHeader("X-Content-Type-Options", "nosniff");

  // 4. XSS filter (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // 5. Clickjacking protection
  res.setHeader("X-Frame-Options", "DENY");

  // 6. Referrer policy — limit info leakage
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // 7. Permissions policy — restrict browser features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );

  // 8. Remove server identification (OWASP A05)
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Server", "FYK");

  // 9. Prevent caching of sensitive API responses
  if (req.url?.startsWith("/api/")) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    res.setHeader("Pragma", "no-cache");
  }

  next();
}

server.middlewares.use(securityHeaders);

server.middlewares.use((req, res, next) => {
  try {
    next();
  } catch (err) {
    console.error("SSR Error:", err);
    res.setHeader("Content-Type", "text/html");
    res.end(`
      <!DOCTYPE html>
      <html><head><title>FYK</title></head>
      <body>
        <div id="root"></div>
        <script type="module" src="/@id/virtual:tanstack-start-dev-client-entry"></script>
      </body>
    </html>
    `);
  }
});

await server.listen();
console.log("Server running at http://localhost:3000");
