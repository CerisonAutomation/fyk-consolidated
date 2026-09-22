import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/offline/")({
  component: OfflinePage,
});

function OfflinePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);

  const fetchQueue = async () => {
    const res = await fetch("/api/offline/queue");
    const data = await res.json();
    setQueue(data.queue ?? []);
    setPending(data.pending ?? []);
  };

  const flush = async () => {
    await fetch("/api/offline/queue?action=flush", { method: "POST" });
    fetchQueue();
  };

  useEffect(() => { fetchQueue(); }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Offline Queue & Backup (12.4, 23.5)</h1>
      <p className="text-sm text-muted-foreground">Per-user IndexedDB mirroring, FTS chat index, encrypted backup PIN, offline queue flush on reconnect — production with AES-GCM</p>
      <div className="flex gap-2">
        <button onClick={fetchQueue} className="px-3 py-1 border rounded text-sm">Refresh</button>
        <button onClick={flush} className="px-3 py-1 bg-primary text-white rounded text-sm">Flush {pending.length} Pending</button>
      </div>
      <div className="text-sm">Queue: {queue.length} total, {pending.length} pending</div>
      <div className="space-y-1">
        {queue.slice(0,10).map((q: any) => <div key={q.id} className="border rounded p-2 text-xs flex justify-between"><span>{q.action} — {q.status} (attempts {q.attempts})</span><span>{new Date(q.createdAt).toLocaleTimeString()}</span></div>)}
      </div>
    </div>
  );
}
