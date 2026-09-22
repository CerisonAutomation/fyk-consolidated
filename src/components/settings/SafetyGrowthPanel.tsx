/**
 * SafetyGrowthPanel — Canonical safety, monetization, growth panels
 * Wires: useSafety, useConsumables, useCalendar, useSpeedDating, useStats, useOfflineQueue
 */

import { useState } from "react";
import {
  useSafety,
  useConsumables,
  useCalendar,
  useSpeedDating,
  useStats,
  useOfflineQueue,
} from "#/hooks/app-hooks";

export function EmergencySharePanel() {
  const safety = useSafety();
  const [place, setPlace] = useState("");
  const [message, setMessage] = useState("");

  const share = async () => {
    await safety.shareEmergency({
      contactId: "00000000-0000-0000-0000-000000000001",
      lat: 35.9,
      lng: 14.5,
      place,
      message,
    });
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Safety — Emergency Share</h3>
      <p className="text-xs text-muted-foreground">One-tap shares live location with trusted contact via SMS. Uses useSafety hook.</p>
      <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Place" className="w-full border rounded p-2 text-sm" />
      <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" className="w-full border rounded p-2 text-sm" />
      <button type="button" onClick={share} className="w-full py-2 bg-red-500 text-white rounded text-sm" disabled={safety.sharing}>
        {safety.sharing ? "Sharing..." : "Share Emergency Location"}
      </button>
      <div className="text-xs">Shares: {safety.emergencyShares.length}</div>
    </div>
  );
}

export function RateLimitPanel() {
  const [limits, setLimits] = useState<{ limits?: Record<string, { remaining: number; limit: number; window: string }>; blockedCount?: number } | null>(null);

  const fetchLimits = async () => {
    const res = await fetch("/api/safety/rate-limit");
    const data = await res.json() as typeof limits;
    setLimits(data);
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Rate Limiting / Anti-Spam</h3>
      <p className="text-xs text-muted-foreground">Velocity limits, mass-report throttles, bot heuristics</p>
      <button type="button" onClick={fetchLimits} className="px-3 py-1 border rounded text-sm">Check Limits</button>
      {limits && (
        <div className="text-xs space-y-1">
          <div>Messages: {limits.limits?.messages?.remaining}/{limits.limits?.messages?.limit} per {limits.limits?.messages?.window}</div>
          <div>Blocked: {limits.blockedCount}</div>
        </div>
      )}
    </div>
  );
}

export function DeletionPanel() {
  const safety = useSafety();
  const [request, setRequest] = useState<{ status: string; graceEndsAt: string } | null>(null);

  const fetchRequest = async () => {
    const res = await fetch("/api/profile/deletion");
    const data = await res.json() as { request: typeof request };
    setRequest(data.request);
  };

  const requestDeletion = async () => {
    const res = await fetch("/api/profile/deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Privacy", confirm: "DELETE" }),
    });
    const data = await res.json() as { request: typeof request };
    setRequest(data.request);
    safety.requestDeletion({ id: crypto.randomUUID() });
  };

  const cancel = async () => {
    const res = await fetch("/api/profile/deletion", { method: "DELETE" });
    const data = await res.json() as { ok: boolean };
    if (data.ok) {
      setRequest(null);
      safety.cancelDeletion();
    }
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Data Export and Account Deletion</h3>
      <p className="text-xs text-muted-foreground">GDPR export and deletion with grace period. Uses useSafety.</p>
      <button type="button" onClick={fetchRequest} className="px-3 py-1 border rounded text-sm">Check Status</button>
      {request ? (
        <div className="space-y-2">
          <div className="text-xs">Status: {request.status} — Grace ends {new Date(request.graceEndsAt).toLocaleDateString()}</div>
          <button type="button" onClick={cancel} className="w-full py-1 bg-green-500 text-white rounded text-xs">Cancel Deletion</button>
        </div>
      ) : (
        <button type="button" onClick={requestDeletion} className="w-full py-1 bg-red-500 text-white rounded text-xs">Request Deletion (30d grace)</button>
      )}
    </div>
  );
}

export function ConsumablesPanel() {
  const consumables = useConsumables();
  const [catalog, setCatalog] = useState<Array<{ sku: string; name: string; priceCoins: number }>>([]);

  const fetchData = async () => {
    const res = await fetch("/api/monetization/consumables");
    const data = await res.json() as { catalog: typeof catalog; inventory: Array<{ type: string; quantity: number }> };
    setCatalog(data.catalog);
  };

  const purchase = async (sku: string) => {
    await consumables.purchase(sku, 1);
    fetchData();
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Consumables Shop</h3>
      <p className="text-xs text-muted-foreground">Boost, read receipts, super likes, spotlight. Uses useConsumables hook.</p>
      <button type="button" onClick={fetchData} className="px-3 py-1 border rounded text-sm">Load Shop</button>
      <div className="grid grid-cols-2 gap-2">
        {catalog.slice(0, 6).map((item) => (
          <div key={item.sku} className="border rounded p-2 text-xs">
            <div className="font-medium">{item.name}</div>
            <div>{item.priceCoins} coins</div>
            <button type="button" onClick={() => purchase(item.sku)} className="mt-1 w-full py-1 bg-primary text-white rounded text-xs" disabled={consumables.purchasing}>
              Buy
            </button>
          </div>
        ))}
      </div>
      <div className="text-xs">Inventory: {Object.entries(consumables.inventory).map(([k, v]) => `${k} x${v}`).join(", ") || "empty"}</div>
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
    const data = await res.json() as typeof result;
    setResult(data);
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Promo Codes</h3>
      <p className="text-xs text-muted-foreground">WELCOME15, PREMIUM20, ELITE30 canonical — legacy DIVINE15 aliases supported</p>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME15" className="flex-1 border rounded p-2 text-sm" />
        <button type="button" onClick={redeem} className="px-3 py-1 bg-primary text-white rounded text-sm">Redeem</button>
      </div>
      {result && <div className="text-xs p-2 bg-muted rounded">{result.ok ? result.message : result.error ?? result.message}</div>}
    </div>
  );
}

export function GrowthPanel() {
  const stats = useStats();
  const offline = useOfflineQueue();
  const [funnel, setFunnel] = useState<{ progress?: { completed: number; total: number }; funnel?: string[]; steps?: Array<{ step: string }> } | null>(null);

  const fetchFunnel = async () => {
    const res = await fetch("/api/growth/funnel");
    const data = await res.json() as typeof funnel;
    setFunnel(data);
  };

  const trackStep = async (step: string) => {
    await fetch("/api/growth/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    offline.enqueue("track_funnel", { step });
    fetchFunnel();
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Growth and Retention</h3>
      <p className="text-xs text-muted-foreground">Engagement, streaks, completion, funnel. Uses useStats and useOfflineQueue.</p>
      <div className="text-xs">Reply rate: {Math.round(stats.replyRate)}% | Best photo: {stats.bestPhoto ? "yes" : "none"} | Offline queue: {offline.pending.length}</div>
      <button type="button" onClick={fetchFunnel} className="px-3 py-1 border rounded text-sm">Load Funnel</button>
      {funnel && (
        <div className="text-xs space-y-1">
          <div>Progress: {Math.round(((funnel.progress?.completed ?? 0) / (funnel.progress?.total ?? 1)) * 100)}%</div>
          <div className="flex flex-wrap gap-1">
            {funnel.funnel?.map((s) => (
              <button
                key={s}
                type="button"
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
  const speedDating = useSpeedDating();
  const calendar = useCalendar();
  const [events, setEvents] = useState<Array<{ id: string; title: string; startsAt: string; maxParticipants: number; roundDurationSec: number }>>([]);

  const fetchEvents = async () => {
    const res = await fetch("/api/speed-dating");
    const data = await res.json() as { events: typeof events };
    setEvents(data.events);
  };

  const join = async (eventId: string) => {
    await speedDating.join(eventId);
    calendar.addEvent({ id: eventId, startsAt: new Date().toISOString(), title: "Speed dating", provider: "none" } as never);
    fetchEvents();
  };

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Speed Dating</h3>
      <p className="text-xs text-muted-foreground">3-5 min video rounds, queue, rotate, match unlocks thread. Uses useSpeedDating and useCalendar.</p>
      <div className="text-xs">My participations: {speedDating.participations.length} | Calendar: {calendar.events.length} events | Free slots: {calendar.freeSlots.length}</div>
      <button type="button" onClick={fetchEvents} className="px-3 py-1 border rounded text-sm">Load Events</button>
      {events.slice(0, 3).map((e) => (
        <div key={e.id} className="border rounded p-2 text-xs flex justify-between">
          <div>
            <div className="font-medium">{e.title}</div>
            <div>{new Date(e.startsAt).toLocaleString()} — {e.maxParticipants} max, {e.roundDurationSec}s rounds</div>
          </div>
          <button type="button" onClick={() => join(e.id)} className="px-2 py-1 bg-primary text-white rounded" disabled={speedDating.joining}>
            Join
          </button>
        </div>
      ))}
    </div>
  );
}
