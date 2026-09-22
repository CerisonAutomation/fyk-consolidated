/**
 * Privacy Report Card — 27.10
 * Monthly digest: who saw profile, who blocked, what data used for, activity timeline.
 */

export type PrivacyReport = {
  userId: string;
  period: { from: string; to: string };
  profileViews: { count: number; unique: number };
  blocked: { count: number; ids: string[] };
  dataUsage: {
    discovery: boolean;
    matching: boolean;
    ai: boolean;
    analytics: boolean;
  };
  activity: {
    logins: number;
    messagesSent: number;
    tapsSent: number;
    photosUploaded: number;
  };
  exports: { count: number; lastAt?: string };
  generatedAt: string;
};

export function generatePrivacyReport(params: {
  userId: string;
  from: string;
  to: string;
  profileViews: number;
  uniqueViewers: number;
  blockedCount: number;
  blockedIds: string[];
  logins: number;
  messagesSent: number;
  tapsSent: number;
  photosUploaded: number;
  exportsCount: number;
  lastExportAt?: string;
}): PrivacyReport {
  return {
    userId: params.userId,
    period: { from: params.from, to: params.to },
    profileViews: { count: params.profileViews, unique: params.uniqueViewers },
    blocked: { count: params.blockedCount, ids: params.blockedIds },
    dataUsage: {
      discovery: true,
      matching: true,
      ai: true,
      analytics: true,
    },
    activity: {
      logins: params.logins,
      messagesSent: params.messagesSent,
      tapsSent: params.tapsSent,
      photosUploaded: params.photosUploaded,
    },
    exports: { count: params.exportsCount, lastAt: params.lastExportAt },
    generatedAt: new Date().toISOString(),
  };
}

export function getPrivacyReportSummary(report: PrivacyReport): string {
  return `From ${report.period.from} to ${report.period.to}: ${report.profileViews.count} views (${report.profileViews.unique} unique), ${report.blocked.count} blocked, ${report.activity.messagesSent} messages sent. Data used for discovery, matching, AI, analytics.`;
}
