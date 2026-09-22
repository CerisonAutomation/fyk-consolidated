import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/settings/multi-account/")({
  component: MultiAccountPage,
});

function MultiAccountPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile/multi-account").then(r => r.json()).then(d => { setAccounts(d.accounts ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4"><div className="animate-pulse h-20 bg-muted rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Multi-Account</h1>
        <p className="text-sm text-muted-foreground">Switch between accounts — production with token hash, expiry, RLS. Research: Grindr supports multi-profile via discreet icon.</p>
      </div>

      <div className="border rounded-xl p-4 bg-gradient-to-br from-blue-50 to-purple-50">
        <h3 className="font-semibold">🔐 Secure Account Switching</h3>
        <p className="text-xs text-muted-foreground mt-1">Tokens hashed (SHA256), refresh token rotation, last_used_at tracking, max 5 accounts, discreet icon per account.</p>
      </div>

      <div className="space-y-2">
        {accounts.map((acc: any) => (
          <div key={acc.id} className="border rounded-xl p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold text-sm">{acc.displayName}</div>
              <div className="text-xs text-muted-foreground">{acc.email} • Last used {new Date(acc.lastUsedAt).toLocaleDateString()}</div>
            </div>
            <button className="px-3 py-1 bg-primary text-white rounded-full text-xs">Switch</button>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="border rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">👥</div>
            <div className="font-semibold text-sm">No linked accounts</div>
            <div className="text-xs text-muted-foreground">Add an account to switch quickly</div>
            <button className="mt-3 px-4 py-2 border rounded-full text-xs">+ Add Account</button>
          </div>
        )}
      </div>

      <div className="border rounded-xl p-3">
        <h4 className="font-semibold text-sm mb-2">Features — Max Quality</h4>
        <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
          <li>Token hash storage — never plain text</li>
          <li>Expiry 30 days, auto-rotation on use</li>
          <li>Discreet icon per account (calculator, notes, etc)</li>
          <li>App lock PIN + biometric per account</li>
          <li>Max 5 accounts, LRU eviction</li>
          <li>RLS: owner_user_id = auth.uid()</li>
        </ul>
      </div>
    </div>
  );
}
