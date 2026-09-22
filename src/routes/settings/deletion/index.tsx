import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/settings/deletion/")({
  component: DeletionPage,
});

function DeletionPage() {
  const [request, setRequest] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile/deletion").then(r => r.json()).then(d => { setRequest(d.request ?? null); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4"><div className="animate-pulse h-20 bg-muted rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Delete Account</h1>
        <p className="text-sm text-muted-foreground">GDPR right to erasure — 30 days grace, cancel anytime, full wipe of messages, media, matches. Research: Grindr 30d grace, Tinder immediate — we do grace for safety.</p>
      </div>

      {request ? (
        <div className="border rounded-xl p-4 bg-yellow-50 border-yellow-200">
          <h3 className="font-semibold text-yellow-800">⏳ Deletion Scheduled</h3>
          <p className="text-xs text-yellow-700 mt-1">Grace ends {new Date(request.graceEndsAt).toLocaleDateString()} — status {request.status}. You can cancel anytime before then.</p>
          <div className="flex gap-2 mt-3">
            <button className="flex-1 py-2 bg-white border border-yellow-300 rounded-full text-xs">Cancel Deletion</button>
            <button className="flex-1 py-2 bg-red-500 text-white rounded-full text-xs">Delete Now</button>
          </div>
        </div>
      ) : (
        <div className="border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">⚠️ This will delete everything</h3>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            <li>Profile, photos, bio, preferences</li>
            <li>Messages, matches, likes, blocks</li>
            <li>Subscription, coins, gifts</li>
            <li>Cannot be undone after grace period</li>
          </ul>
          <div>
            <label className="text-xs font-semibold">Reason (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Help us improve..." className="w-full mt-1 p-2 border rounded text-xs" rows={3} />
          </div>
          <button className="w-full py-2 bg-red-500 text-white rounded-full text-xs font-semibold">Request Deletion — 30 Days Grace</button>
          <p className="text-[11px] text-muted-foreground text-center">Grace period: cancel anytime, full wipe after 30 days, GDPR compliant</p>
        </div>
      )}

      <div className="border rounded-xl p-3">
        <h4 className="font-semibold text-sm mb-2">Alternatives — Max UX</h4>
        <div className="space-y-2">
          <button className="w-full py-2 border rounded-full text-xs text-left px-3">⏸️ Pause Account (hide, keep data)</button>
          <button className="w-full py-2 border rounded-full text-xs text-left px-3">👻 Incognito Mode (browse privately)</button>
          <button className="w-full py-2 border rounded-full text-xs text-left px-3">🧹 Clear History (keep account)</button>
        </div>
      </div>
    </div>
  );
}
