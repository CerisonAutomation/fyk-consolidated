import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/settings/privacy-report/")({
  component: PrivacyReportPage,
});

function PrivacyReportPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/privacy-report");
      const data = await res.json();
      setReport(data.report);
    } finally { setLoading(false); }
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/privacy-report", { method: "POST" });
      const data = await res.json();
      setReport(data.report);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Privacy Report Card (27.10)</h1>
      <p className="text-sm text-muted-foreground">Monthly digest: who saw profile, blocked, data used for, activity timeline, export/delete links</p>
      <div className="flex gap-2">
        <button onClick={fetchReport} disabled={loading} className="px-3 py-1 border rounded text-sm">Refresh</button>
        <button onClick={generate} disabled={loading} className="px-3 py-1 bg-primary text-white rounded text-sm">Generate New</button>
      </div>
      {report && (
        <div className="border rounded-xl p-4 space-y-2 text-sm">
          <div>Period: {new Date(report.period_from ?? report.period?.from).toLocaleDateString()} → {new Date(report.period_to ?? report.period?.to).toLocaleDateString()}</div>
          <div>Views: {report.profile_views ?? report.profileViews?.count} total, {report.unique_viewers ?? report.profileViews?.unique} unique</div>
          <div>Blocked: {report.blocked_count ?? report.blocked?.count}</div>
          <div>Generated: {new Date(report.generated_at ?? report.generatedAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
