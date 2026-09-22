import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { telemetry } from "@/lib/enterprise/telemetry";
import { traceRequest, finishTrace, auditTrail } from "@/lib/enterprise/observability";
import { auditLogger } from "@/lib/enterprise/security-hardened";

/**
 * Safety 2FA alias — redirects to /api/auth/2fa for consistency
 * 21.1 Two-Factor Auth — enterprise hardened with telemetry + audit
 */

export const Route = createFileRoute("/api/safety/2fa/")({
  server: {
    handlers: {
      GET: withSecurity(
        async ({ caller, request }) => {
          const trace = traceRequest(request);
          const span = telemetry.startSpan("api.safety.2fa.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

          try {
            const user = requireCaller(caller);
            telemetry.counter("api.safety.2fa.info", 1, { userId: user.id.slice(0, 8) });
            telemetry.endSpan(span.spanId, "ok");
            finishTrace(trace, 200);

            return json({
              message: "Use /api/auth/2fa for TOTP setup",
              status: "alias",
              canonical: "/api/auth/2fa",
              endpoints: {
                setup: "POST /api/auth/2fa {action:'setup'}",
                verify: "POST /api/auth/2fa {action:'verify', code, secret}",
                enable: "POST /api/auth/2fa {action:'enable', code}",
                disable: "POST /api/auth/2fa {action:'disable', code}",
                backupCodes: "POST /api/auth/2fa {action:'backup_codes'}",
                recovery: "POST /api/auth/2fa {action:'recovery', backupCode}",
              },
              security: {
                algorithm: "TOTP SHA-1 6-digit 30s",
                issuer: "FYK",
                backupCodes: 10,
                recoveryFlow: true,
                enforcedFor: ["admin", "moderator"],
              },
              traceId: trace.traceId,
            });
          } catch (error) {
            telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
            finishTrace(trace, 500);
            throw error;
          }
        },
        { rateLimit: { limit: 30, key: ({ ip }) => `safety-2fa:${ip}` } },
      ),
      POST: withSecurity(
        async ({ caller, request }) => {
          const trace = traceRequest(request);
          const span = telemetry.startSpan("api.safety.2fa.post", "server", undefined, { userId: caller?.id ?? "anonymous" });
          try {
            const user = requireCaller(caller);
            auditLogger.log({ userId: user.id, action: "safety.2fa.alias_used", resource: "auth", result: "success", details: { traceId: trace.traceId } });
            auditTrail.record({ userId: user.id, action: "safety.2fa.alias_used", resource: "auth", traceId: trace.traceId });
            telemetry.counter("api.safety.2fa.redirect", 1);
            telemetry.endSpan(span.spanId, "ok");
            finishTrace(trace, 200);
            return json({ redirect: "/api/auth/2fa", message: "Use canonical endpoint", traceId: trace.traceId });
          } catch (error) {
            telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
            finishTrace(trace, 500);
            throw error;
          }
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `safety.2fa:POST:${caller?.id}` } },
      ),
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
    },
  },
});
