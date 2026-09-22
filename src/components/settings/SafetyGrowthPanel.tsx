/**
 * SafetyGrowthPanel — Canonical safety, monetization, growth panels
 * Professional naming, clean implementation
 */

import { useState } from "react";

export function EmergencySharePanel() {
  const [place, setPlace] = useState("");
  const [message, setMessage] = useState("");
  const [shares, setShares] = useState<Array<{ id: string; place: string; expiresAt: string }>>([]);

  const share = async () => {
    const res = await fetch("/api/safety/emergency-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: "00000000-0000-0000-0000-000000000001", lat: 35.9, lng: 14.5, place, message }),
    });
    const data = await res.json();
    if (data.ok) setShares((s) => [data.share, ...s]);
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Safety — Emergency Share</h3>
      <p className="text-xs text-muted-foreground">One-tap shares live location with trusted contact via SMS</p>
      <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Place" className="w-full border rounded p-2 text-sm" />
      <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" className="w-full border rounded p-2 text-sm" />
      <button onClick={share} className="w-full py-2 bg-red-500 text-white rounded text-sm">
        Share Emergency Location
      </button>
      {shares.slice(0, 2).map((s) => (
        <div key={s.id} className="text-xs border rounded p-1">
          Shared at {s.place} — expires {new Date(s.expiresAt).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export function RateLimitPanel() {
  const [limits, setLimits] = useState<{ limits?: Record<string, { remaining: number; limit: number; window: string }>; blockedCount?: number } | null>(null);

  const fetchLimits = async () => {
    const res = await fetch("/api/safety/rate-limit");
    const data = await res.json();
    setLimits(data);
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Rate Limiting / Anti-Spam</h3>
      <p className="text-xs text-muted-foreground">Velocity limits, mass-report throttles, bot heuristics</p>
      <button onClick={fetchLimits} className="px-3 py-1 border rounded text-sm">
        Check Limits
      </button>
      {limits && (
        <div className="text-xs space-y-1">
          <div>
            Messages: {limits.limits?.messages?.remaining}/{limits.limits?.messages?.limit} per {limits.limits?.messages?.window}
          </div>
          <div>Blocked: {limits.blockedCount}</div>
        </div>
      )}
    </div>
  );
}

export function DeletionPanel() {
  const [request, setRequest] = useState<{ status: string; graceEndsAt: string } | null>(null);

  const fetchRequest = async () => {
    const res = await fetch("/api/profile/deletion");
    const data = await res.json();
    setRequest(data.request);
  };

  const requestDeletion = async () => {
    const res = await fetch("/api/profile/deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Privacy", confirm: "DELETE" }),
    });
    const data = await res.json();
    setRequest(data.request);
  };

  const cancel = async () => {
    const res = await fetch("/api/profile/deletion", { method: "DELETE" });
    const data = await res.json();
    if (data.ok) setRequest(null);
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Data Export and Account Deletion</h3>
      <p className="text-xs text-muted-foreground">GDPR export and deletion with grace period</p>
      <button onClick={fetchRequest} className="px-3 py-1 border rounded text-sm">
        Check Status
      </button>
      {request ? (
        <div className="space-y-2">
          <div className="text-xs">
            Status: {request.status} — Grace ends {new Date(request.graceEndsAt).toLocaleDateString()}
          </div>
          <button onClick={cancel} className="w-full py-1 bg-green-500 text-white rounded text-xs">
            Cancel Deletion
          </button>
        </div>
      ) : (
        <button onClick={requestDeletion} className="w-full py-1 bg-red-500 text-white rounded text-xs">
          Request Deletion (30d grace)
        </button>
      )}
    </div>
  );
}

export function ConsumablesPanel() {
  const [catalog, setCatalog] = useState<Array<{ sku: string; name: string; priceCoins: number }>>([]);
  const [inventory, setInventory] = useState<Array<{ type: string; quantity: number }>>([]);

  const fetchData = async () => {
    const res = await fetch("/api/monetization/consumables");
    const data = await res.json();
    setCatalog(data.catalog);
    setInventory(data.inventory);
  };

  const purchase = async (sku: string) => {
    await fetch("/api/monetization/consumables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, quantity: 1, idempotencyKey: crypto.randomUUID() }),
    });
    fetchData();
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Consumables Shop</h3>
      <p className="text-xs text-muted-foreground">Boost, read receipts, super likes, spotlight</p>
      <button onClick={fetchData} className="px-3 py-1 border rounded text-sm">
        Load Shop
      </button>
      <div className="grid grid-cols-2 gap-2">
        {catalog.slice(0, 6).map((item) => (
          <div key={item.sku} className="border rounded p-2 text-xs">
            <div className="font-medium">{item.name}</div>
            <div>{item.priceCoins} coins</div>
            <button onClick={() => purchase(item.sku)} className="mt-1 w-full py-1 bg-primary text-white rounded text-xs">
              Buy
            </button>
          </div>
        ))}
      </div>
      {inventory.length > 0 && <div className="text-xs">Inventory: {inventory.map((i) => `${i.type} x${i.quantity}`).join(", ")}</div>}
    </div>
  );
}

export function PromoPanel() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

  const redeem = async () => {
    const res = await fetch("/api/monetization/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setResult(data);
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Promo Codes</h3>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PROMO15" className="flex-1 border rounded p-2 text-sm" />
        <button onClick={redeem} className="px-3 py-1 bg-primary text-white rounded text-sm">
          Redeem
        </button>
      </div>
      {result && <div className="text-xs p-2 bg-muted rounded">{result.ok ? result.message : result.error ?? result.message}</div>}
    </div>
  );
}

export function GrowthPanel() {
  const [funnel, setFunnel] = useState<{ progress?: { completed: number; total: number }; funnel?: string[]; steps?: Array<{ step: string }> } | null>(null);

  const fetchFunnel = async () => {
    const res = await fetch("/api/growth/funnel");
    const data = await res.json();
    setFunnel(data);
  };

  const trackStep = async (step: string) => {
    await fetch("/api/growth/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    fetchFunnel();
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Growth and Retention</h3>
      <p className="text-xs text-muted-foreground">Engagement, streaks, completion, funnel</p>
      <button onClick={fetchFunnel} className="px-3 py-1 border rounded text-sm">
        Load Funnel
      </button>
      {funnel && (
        <div className="text-xs space-y-1">
          <div>Progress: {Math.round(((funnel.progress?.completed ?? 0) / (funnel.progress?.total ?? 1)) * 100)}%</div>
          <div className="flex flex-wrap gap-1">
            {funnel.funnel?.map((s) => (
              <button
                key={s}
                onClick={() => trackStep(s)}
                className={`px-2 py-1 rounded text-xs ${funnel.steps?.some((st) => st.step === s) ? "bg-green-500 text-white" : "border"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SpeedDatingPanel() {
  const [events, setEvents] = useState<Array<{ id: string; title: string; startsAt: string; maxParticipants: number; roundDurationSec: number }>>([]);

  const fetchEvents = async () => {
    const res = await fetch("/api/speed-dating");
    const data = await res.json();
    setEvents(data.events);
  };

  const join = async (eventId: string) => {
    await fetch("/api/speed-dating?action=join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    fetchEvents();
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Speed Dating</h3>
      <p className="text-xs text-muted-foreground">3-5 min video rounds, queue, rotate, match unlocks thread</p>
      <button onClick={fetchEvents} className="px-3 py-1 border rounded text-sm">
        Load Events
      </button>
      {events.slice(0, 3).map((e) => (
        <div key={e.id} className="border rounded p-2 text-xs flex justify-between">
          <div>
            <div className="font-medium">{e.title}</div>
            <div>
              {new Date(e.startsAt).toLocaleString()} — {e.maxParticipants} max, {e.roundDurationSec}s rounds
            </div>
          </div>
          <button onClick={() => join(e.id)} className="px-2 py-1 bg-primary text-white rounded">
            Join
          </button>
        </div>
      ))}
    </div>
  );
}
