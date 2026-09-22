import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/settings/export/")({
  component: ExportPage,
});

function ExportPage() {
  const [exports, setExports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile/export").then(r => r.json()).then(d => { setExports(d.exports ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4"><div className="animate-pulse h-20 bg-muted rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Data Export</h1>
        <p className="text-sm text-muted-foreground">GDPR right to data portability — production with encrypted ZIP, expiry 7 days, includes messages, media, settings. Research: Romeo offers full export.</p>
      </div>

      <div className="border rounded-xl p-4 bg-gradient-to-br from-green-50 to-blue-50">
        <h3 className="font-semibold">📦 Your Data, Your Right</h3>
        <p className="text-xs text-muted-foreground mt-1">Export includes profile, messages, photos, settings, blocks, favorites. Encrypted with AES-GCM, password via separate channel.</p>
        <button className="mt-3 w-full py-2 bg-primary text-white rounded-full text-xs font-semibold">Request Full Export</button>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Recent Exports</h4>
        {exports.map((exp: any) => (
          <div key={exp.id} className="border rounded-xl p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold text-sm">{exp.includes?.join(", ") ?? "Full export"} — {exp.status}</div>
              <div className="text-xs text-muted-foreground">Requested {new Date(exp.requestedAt).toLocaleString()} {exp.expiresAt ? `• Expires ${new Date(exp.expiresAt).toLocaleDateString()}` : ""}</div>
            </div>
            {exp.status === "ready" && <button className="px-3 py-1 bg-green-500 text-white rounded-full text-xs">Download</button>}
          </div>
        ))}
        {exports.length === 0 && (
          <div className="border rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">📤</div>
            <div className="font-semibold text-sm">No exports yet</div>
            <div className="text-xs text-muted-foreground">Request one — ready in ~5 min, expires in 7 days</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-xl p-3 text-center">
          <div className="text-xl">🔒</div>
          <div className="font-semibold text-xs">Encrypted</div>
          <div className="text-[11px] text-muted-foreground">AES-GCM 256-bit</div>
        </div>
        <div className="border rounded-xl p-3 text-center">
          <div className="text-xl">⏰</div>
          <div className="font-semibold text-xs">7 Days</div>
          <div className="text-[11px] text-muted-foreground">Auto-delete after</div>
        </div>
      </div>
    </div>
  );
}
