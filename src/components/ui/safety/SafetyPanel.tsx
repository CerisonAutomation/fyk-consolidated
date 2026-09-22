/**
 * SafetyPanel — Canonical safety center, professional naming
 * Replaces SafetyCenter (divine naming)
 */

import { useEffect, useState } from "react";

export function SafetyPanel() {
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; relationship: string; phone: string }>>([]);
  const [checkIns, setCheckIns] = useState<Array<{ id: string; place: string; status: string; armedAt: string; dueAt: string }>>([]);

  useEffect(() => {
    fetch("/api/safety/contacts")
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []))
      .catch(() => {});
    fetch("/api/safety/check-in")
      .then((r) => r.json())
      .then((d) => setCheckIns(d.checkIns ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border p-4">
        <h3 className="font-bold flex items-center gap-2">Safety Center</h3>
        <p className="text-xs text-muted-foreground mt-1">Emergency share, check-ins, trusted contacts — production with DB and SMS.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-xl p-3 text-center">
          <div className="text-2xl">!</div>
          <div className="font-semibold text-sm">Emergency Share</div>
          <div className="text-[11px] text-muted-foreground">One-tap SMS with live location</div>
          <button className="mt-2 w-full py-1 bg-red-500 text-white rounded text-xs">Share Now</button>
        </div>
        <div className="border rounded-xl p-3 text-center">
          <div className="text-2xl">T</div>
          <div className="font-semibold text-sm">Check-In</div>
          <div className="text-[11px] text-muted-foreground">Delayed safe-ping if not cancelled</div>
          <button className="mt-2 w-full py-1 border rounded text-xs">Arm Check-In</button>
        </div>
      </div>

      <div className="border rounded-xl p-3">
        <h4 className="font-semibold text-sm mb-2">Trusted Contacts ({contacts.length})</h4>
        {contacts.slice(0, 3).map((c) => (
          <div key={c.id} className="flex justify-between items-center py-1 border-b last:border-0 text-xs">
            <span>
              {c.name} — {c.relationship}
            </span>
            <span className="text-muted-foreground">{c.phone}</span>
          </div>
        ))}
        {contacts.length === 0 && <div className="text-xs text-muted-foreground">No trusted contacts — add one for safety</div>}
      </div>

      <div className="border rounded-xl p-3">
        <h4 className="font-semibold text-sm mb-2">Recent Check-Ins ({checkIns.length})</h4>
        {checkIns.slice(0, 3).map((c) => (
          <div key={c.id} className="py-1 border-b last:border-0 text-xs">
            <div className="flex justify-between">
              <span>{c.place}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${c.status === "armed" ? "bg-yellow-500 text-white" : c.status === "safe" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
              >
                {c.status}
              </span>
            </div>
            <div className="text-muted-foreground">
              {new Date(c.armedAt).toLocaleString()} → {new Date(c.dueAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
