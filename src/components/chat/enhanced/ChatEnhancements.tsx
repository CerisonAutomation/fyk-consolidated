import { useState } from "react";
import { useChatEnhancements, useScheduledMessages } from "#/hooks/app-hooks";

export function PinnedMessages({ conversationId }: { conversationId: string }) {
  const { pinned, unpin } = useChatEnhancements(conversationId);
  return (
    <div className="border rounded-xl p-3 space-y-2">
      <h4 className="font-semibold text-sm">Pinned Messages — {pinned.length}/10</h4>
      {pinned.map((p) => (
        <div key={p.messageId} className="flex justify-between items-center text-xs border rounded p-2">
          <span>{p.messageId.slice(0, 8)}...</span>
          <button type="button" onClick={() => unpin(conversationId, p.messageId)} className="text-red-500">Unpin</button>
        </div>
      ))}
      {pinned.length === 0 && <div className="text-xs text-muted-foreground">No pinned messages</div>}
    </div>
  );
}

export function EphemeralSettings({ conversationId }: { conversationId: string }) {
  const { ephemeral, setEphemeral } = useChatEnhancements(conversationId);
  const ephemeralData = ephemeral as { durationSec?: number; enabled?: boolean } | null;
  const [duration, setDuration] = useState(ephemeralData?.durationSec ?? 0);
  const [enabled, setEnabled] = useState(ephemeralData?.enabled ?? false);

  const save = () => setEphemeral(conversationId, { durationSec: duration, enabled, updatedAt: new Date().toISOString() });

  return (
    <div className="border rounded-xl p-3 space-y-2">
      <h4 className="font-semibold text-sm">Disappearing Messages</h4>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable disappearing messages
      </label>
      <select value={duration} onChange={(e) => setDuration(Number.parseInt(e.target.value, 10))} className="w-full border rounded p-1 text-xs">
        <option value={0}>Off</option>
        <option value={300}>5 minutes</option>
        <option value={3600}>1 hour</option>
        <option value={86400}>24 hours</option>
        <option value={604800}>7 days</option>
      </select>
      <button type="button" onClick={save} className="w-full py-1 bg-primary text-white rounded text-xs">Save</button>
    </div>
  );
}

export function ScheduledComposer({ conversationId }: { conversationId: string }) {
  const { scheduled, scheduleMessage } = useScheduledMessages(conversationId);
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const handleSchedule = async () => {
    if (!body || !scheduledAt) return;
    await scheduleMessage({ conversationId, body, scheduledAt });
    setBody("");
    setScheduledAt("");
  };

  return (
    <div className="border rounded-xl p-3 space-y-2">
      <h4 className="font-semibold text-sm">Scheduled Messages — {scheduled.length}</h4>
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message to schedule" className="w-full border rounded p-2 text-xs" />
      <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full border rounded p-1 text-xs" />
      <button type="button" onClick={handleSchedule} className="w-full py-1 bg-primary text-white rounded text-xs">Schedule Send</button>
      {scheduled.slice(0, 3).map((m) => (
        <div key={m.id} className="text-xs border rounded p-1">{(m.body ?? "").slice(0, 30)}... @ {new Date(m.scheduledAt).toLocaleString()}</div>
      ))}
    </div>
  );
}

export function ScreenshotProtection({ conversationId }: { conversationId: string }) {
  const { logScreenshot } = useChatEnhancements(conversationId);
  return (
    <div className="border rounded-xl p-3 space-y-2">
      <h4 className="font-semibold text-sm">Screenshot Protection</h4>
      <p className="text-xs text-muted-foreground">Blurs preview in app switcher, notifies on screenshot.</p>
      <button type="button" onClick={() => logScreenshot({ id: crypto.randomUUID(), conversationId, platform: "web" })} className="w-full py-1 border rounded text-xs">Simulate Screenshot Detection</button>
    </div>
  );
}

export function RewardedChat({ conversationId }: { conversationId: string }) {
  const [hasAccess, setHasAccess] = useState(false);
  const unlock = async () => {
    const res = await fetch("/api/chat/rewarded", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, source: "ad" }) });
    const data = await res.json() as { ok?: boolean };
    if (data.ok) setHasAccess(true);
  };
  return (
    <div className="border rounded-xl p-3 space-y-2">
      <h4 className="font-semibold text-sm">Rewarded Chat</h4>
      <p className="text-xs text-muted-foreground">Watch ad to unlock chat window, server grants temp token.</p>
      {hasAccess ? <div className="text-xs text-green-600">Chat unlocked for 1 hour</div> : <button type="button" onClick={unlock} className="w-full py-1 bg-primary text-white rounded text-xs">Watch Ad to Unlock</button>}
    </div>
  );
}

export function GroupBroadcast({ groupId }: { groupId: string }) {
  const [body, setBody] = useState("");
  const [broadcasts, setBroadcasts] = useState<Array<{ id: string; body: string }>>([]);

  const send = async () => {
    const res = await fetch("/api/chat/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, body }) });
    const data = await res.json() as { ok?: boolean; broadcast?: { id: string; body: string } };
    if (data.ok && data.broadcast) { setBroadcasts((b) => [data.broadcast!, ...b]); setBody(""); }
  };

  return (
    <div className="border rounded-xl p-3 space-y-2">
      <h4 className="font-semibold text-sm">Broadcast to Group</h4>
      <p className="text-xs text-muted-foreground">Admin announcement pings every member.</p>
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Announcement..." className="w-full border rounded p-2 text-xs" />
      <button type="button" onClick={send} className="w-full py-1 bg-primary text-white rounded text-xs">Broadcast</button>
      {broadcasts.slice(0, 3).map((b) => <div key={b.id} className="text-xs border rounded p-1">{b.body}</div>)}
    </div>
  );
}

export function ChatEnhancementsPanel({ conversationId, groupId }: { conversationId: string; groupId?: string }) {
  return (
    <div className="space-y-3">
      <PinnedMessages conversationId={conversationId} />
      <EphemeralSettings conversationId={conversationId} />
      <ScheduledComposer conversationId={conversationId} />
      <ScreenshotProtection conversationId={conversationId} />
      <RewardedChat conversationId={conversationId} />
      {groupId && <GroupBroadcast groupId={groupId} />}
    </div>
  );
}
