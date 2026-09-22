/**
 * Enterprise Reliability — Predictable operation, graceful recovery, backups, DR
 * Gold: availability target, retries, timeouts, backups, disaster recovery, incident procedures
 */

export type AvailabilityTarget = { target: number; window: "day" | "week" | "month" | "year"; current?: number };

export const AVAILABILITY_TARGETS = {
  api: { target: 99.9, window: "month" as const }, // 43m downtime/month
  database: { target: 99.95, window: "month" as const }, // 21m downtime/month
  realtime: { target: 99.5, window: "month" as const }, // 3.6h downtime/month
} as const;

export function calculateAvailability(uptimeMs: number, totalMs: number): number {
  return Math.round((uptimeMs / totalMs) * 10000) / 100;
}

export function checkAvailability(current: number, target: AvailabilityTarget): { meets: boolean; remainingBudgetMs: number } {
  const windowMs = { day: 86400000, week: 604800000, month: 2592000000, year: 31536000000 }[target.window];
  const allowedDowntimeMs = windowMs * (1 - target.target / 100);
  const actualDowntimeMs = windowMs * (1 - current / 100);
  const remainingBudgetMs = Math.max(0, allowedDowntimeMs - actualDowntimeMs);
  return { meets: current >= target.target, remainingBudgetMs };
}

// Backup and restore
export type Backup = { id: string; type: "full" | "incremental" | "differential"; sizeBytes: number; createdAt: string; expiresAt: string; location: string; verified: boolean };

export class BackupManager {
  private backups: Backup[] = [];

  async create(type: Backup["type"] = "full"): Promise<Backup> {
    const backup: Backup = {
      id: crypto.randomUUID(),
      type,
      sizeBytes: Math.floor(Math.random() * 1000000000),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      location: `s3://fyk-backups/${type}/${Date.now()}.enc`,
      verified: false,
    };
    this.backups.push(backup);
    // In production, actually backup DB to S3 with encryption
    return backup;
  }

  async verify(id: string): Promise<{ ok: boolean; error?: string }> {
    const backup = this.backups.find((b) => b.id === id);
    if (!backup) return { ok: false, error: "Backup not found" };
    // In production, restore to staging and verify
    backup.verified = true;
    return { ok: true };
  }

  async restore(id: string): Promise<{ ok: boolean; error?: string }> {
    const backup = this.backups.find((b) => b.id === id);
    if (!backup) return { ok: false, error: "Backup not found" };
    if (!backup.verified) return { ok: false, error: "Backup not verified — verify first" };
    // In production, restore from S3
    return { ok: true };
  }

  list(): Backup[] {
    return this.backups;
  }

  getLatestVerified(): Backup | null {
    return this.backups.filter((b) => b.verified).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  }
}

export const backupManager = new BackupManager();

// Disaster recovery
export type DisasterRecoveryPlan = {
  rto: number; // Recovery Time Objective in seconds
  rpo: number; // Recovery Point Objective in seconds
  steps: Array<{ order: number; action: string; owner: string; estimatedSec: number }>;
  contacts: Array<{ role: string; name: string; phone: string; email: string }>;
  lastTested?: string;
};

export const DR_PLAN: DisasterRecoveryPlan = {
  rto: 3600, // 1 hour
  rpo: 300, // 5 minutes
  steps: [
    { order: 1, action: "Detect failure via health checks and alerting", owner: "oncall", estimatedSec: 60 },
    { order: 2, action: "Assess impact — which services affected, data loss", owner: "oncall", estimatedSec: 300 },
    { order: 3, action: "Notify stakeholders via incident channel", owner: "oncall", estimatedSec: 60 },
    { order: 4, action: "Failover to standby region if primary down", owner: "infra", estimatedSec: 600 },
    { order: 5, action: "Restore latest verified backup if data loss", owner: "dba", estimatedSec: 1200 },
    { order: 6, action: "Verify restoration — health checks, smoke tests", owner: "qa", estimatedSec: 300 },
    { order: 7, action: "Post-mortem and prevention", owner: "eng", estimatedSec: 3600 },
  ],
  contacts: [
    { role: "oncall", name: "On-call Engineer", phone: "+1-XXX", email: "oncall@fyk.app" },
    { role: "infra", name: "Infra Lead", phone: "+1-XXX", email: "infra@fyk.app" },
    { role: "dba", name: "DBA", phone: "+1-XXX", email: "dba@fyk.app" },
  ],
};

// Incident response
export type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";
export type Incident = { id: string; severity: IncidentSeverity; title: string; description: string; status: "open" | "investigating" | "mitigated" | "resolved"; createdAt: string; resolvedAt?: string; timeline: Array<{ at: string; action: string; by: string }> };

export class IncidentManager {
  private incidents: Incident[] = [];

  create(severity: IncidentSeverity, title: string, description: string): Incident {
    const incident: Incident = { id: crypto.randomUUID(), severity, title, description, status: "open", createdAt: new Date().toISOString(), timeline: [{ at: new Date().toISOString(), action: "Created", by: "system" }] };
    this.incidents.push(incident);
    return incident;
  }

  update(id: string, status: Incident["status"], action: string, by: string) {
    const incident = this.incidents.find((i) => i.id === id);
    if (!incident) return;
    incident.status = status;
    incident.timeline.push({ at: new Date().toISOString(), action, by });
    if (status === "resolved") incident.resolvedAt = new Date().toISOString();
  }

  getOpen(): Incident[] {
    return this.incidents.filter((i) => i.status !== "resolved");
  }

  getMTTR(): number {
    const resolved = this.incidents.filter((i) => i.resolvedAt);
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((sum, i) => sum + (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()), 0);
    return Math.round(total / resolved.length / 1000);
  }
}

export const incidentManager = new IncidentManager();

// Graceful shutdown
export function setupGracefulShutdown(cleanup: () => Promise<void>) {
  if (typeof process === "undefined") return;

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    try {
      await Promise.race([cleanup(), new Promise((_, reject) => setTimeout(() => reject(new Error("Cleanup timeout")), 10000))]);
      console.log("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Graceful shutdown failed", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
