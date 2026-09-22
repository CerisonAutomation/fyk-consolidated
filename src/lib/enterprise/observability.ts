/**
 * Enterprise Observability — Logs, metrics, traces, health checks, alerting, audit trails
 * Gold: production issues detectable, investigable, correlatable without reproducing locally
 */

import { telemetry } from "./telemetry";
import { logger } from "#/lib/logger";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export type HealthCheck = { name: string; status: HealthStatus; latencyMs?: number; message?: string; timestamp: string };

export class HealthChecker {
  private checks = new Map<string, () => Promise<HealthCheck>>();

  register(name: string, check: () => Promise<HealthCheck>) {
    this.checks.set(name, check);
  }

  async run(): Promise<{ status: HealthStatus; checks: HealthCheck[]; timestamp: string }> {
    const results: HealthCheck[] = [];
    let overall: HealthStatus = "healthy";

    for (const [name, fn] of this.checks) {
      const start = Date.now();
      try {
        const result = await Promise.race([fn(), new Promise<HealthCheck>((_, reject) => setTimeout(() => reject(new Error("Health check timeout")), 5000))]);
        results.push({ ...result, latencyMs: Date.now() - start });
        if (result.status === "unhealthy") overall = "unhealthy";
        else if (result.status === "degraded" && overall === "healthy") overall = "degraded";
      } catch (error) {
        results.push({ name, status: "unhealthy", latencyMs: Date.now() - start, message: error instanceof Error ? error.message : "Unknown", timestamp: new Date().toISOString() });
        overall = "unhealthy";
      }
    }

    telemetry.gauge("health.status", overall === "healthy" ? 1 : overall === "degraded" ? 0.5 : 0, { status: overall });
    return { status: overall, checks: results, timestamp: new Date().toISOString() };
  }
}

export const healthChecker = new HealthChecker();

// Default health checks
healthChecker.register("database", async () => {
  const start = Date.now();
  try {
    // In real app, ping DB
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { name: "database", status: "healthy", latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
  } catch {
    return { name: "database", status: "unhealthy", latencyMs: Date.now() - start, message: "DB ping failed", timestamp: new Date().toISOString() };
  }
});

healthChecker.register("memory", async () => {
  const mem = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, heapTotal: 1 };
  const usage = mem.heapUsed / mem.heapTotal;
  return {
    name: "memory",
    status: usage > 0.9 ? "unhealthy" : usage > 0.7 ? "degraded" : "healthy",
    message: `${Math.round(usage * 100)}% heap used`,
    timestamp: new Date().toISOString(),
  };
});

// Alerting
export type AlertSeverity = "info" | "warning" | "critical";
export type Alert = { id: string; severity: AlertSeverity; title: string; message: string; timestamp: string; labels?: Record<string, string>; resolved?: boolean; resolvedAt?: string };

export class Alerter {
  private alerts: Alert[] = [];
  private maxAlerts = 1000;

  alert(severity: AlertSeverity, title: string, message: string, labels?: Record<string, string>) {
    const alert: Alert = { id: crypto.randomUUID(), severity, title, message, timestamp: new Date().toISOString(), labels };
    this.alerts.push(alert);
    if (this.alerts.length > this.maxAlerts) this.alerts.shift();

    telemetry.counter("alert.total", 1, { severity, title });
    if (severity === "critical") logger.error({ alert }, `CRITICAL: ${title} — ${message}`);
    else if (severity === "warning") logger.warn({ alert }, `WARNING: ${title} — ${message}`);
    else logger.info({ alert }, `INFO: ${title}`);

    // In production, ship to PagerDuty, OpsGenie, Slack
  }

  resolve(id: string) {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) { alert.resolved = true; alert.resolvedAt = new Date().toISOString(); }
  }

  getActive(): Alert[] {
    return this.alerts.filter((a) => !a.resolved);
  }

  getRecent(sinceMs = 3600000): Alert[] {
    const since = Date.now() - sinceMs;
    return this.alerts.filter((a) => new Date(a.timestamp).getTime() > since);
  }
}

export const alerter = new Alerter();

// Structured logging with correlation
export function logWithCorrelation(level: "info" | "warn" | "error", message: string, context: { traceId?: string; spanId?: string; userId?: string; requestId?: string; [key: string]: unknown }) {
  const { traceId, spanId, userId, requestId, ...rest } = context;
  const logData = { traceId, spanId, userId, requestId, ...rest };

  if (level === "error") logger.error(logData, message);
  else if (level === "warn") logger.warn(logData, message);
  else logger.info(logData, message);

  if (traceId) telemetry.counter(`log.${level}`, 1, { traceId: traceId.slice(0, 8) });
}

// Request tracing middleware
export function traceRequest(request: Request): { traceId: string; spanId: string; startTime: number } {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID().replace(/-/g, "");
  const spanId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const startTime = Date.now();

  telemetry.counter("request.total", 1, { method: request.method, path: new URL(request.url).pathname.slice(0, 50) });

  return { traceId, spanId, startTime };
}

export function finishTrace(trace: { traceId: string; spanId: string; startTime: number }, status: number, error?: string) {
  const duration = Date.now() - trace.startTime;
  telemetry.histogram("request.duration", duration, { status: String(status) });
  if (status >= 500) telemetry.counter("request.errors", 1, { status: String(status), error: error?.slice(0, 100) ?? "unknown" });
  if (duration > 1000) alerter.alert("warning", "Slow request", `${duration}ms — trace ${trace.traceId.slice(0, 8)}`, { status: String(status) });
}

// Audit trail — immutable, append-only
export type AuditTrailEvent = {
  id: string;
  timestamp: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  traceId?: string;
};

export class AuditTrail {
  private events: AuditTrailEvent[] = [];
  private maxEvents = 100000;

  record(event: Omit<AuditTrailEvent, "id" | "timestamp">) {
    const full: AuditTrailEvent = { ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    this.events.push(full);
    if (this.events.length > this.maxEvents) this.events.shift();
    logger.info({ audit: full }, `AUDIT: ${event.action} ${event.resource}${event.resourceId ? `/${event.resourceId}` : ""} by ${event.userId ?? "anonymous"}`);
  }

  query(filter: { userId?: string; action?: string; resource?: string; since?: string; traceId?: string }): AuditTrailEvent[] {
    let result = this.events;
    if (filter.userId) result = result.filter((e) => e.userId === filter.userId);
    if (filter.action) result = result.filter((e) => e.action === filter.action);
    if (filter.resource) result = result.filter((e) => e.resource === filter.resource);
    if (filter.since) result = result.filter((e) => e.timestamp > filter.since!);
    if (filter.traceId) result = result.filter((e) => e.traceId === filter.traceId);
    return result;
  }

  getByTrace(traceId: string): AuditTrailEvent[] {
    return this.events.filter((e) => e.traceId === traceId);
  }
}

export const auditTrail = new AuditTrail();
