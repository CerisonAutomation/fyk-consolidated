import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/calendar/")({
  component: CalendarPage,
});

function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [sync, setSync] = useState<any>(null);

  const fetchCal = async () => {
    const res = await fetch("/api/calendar");
    const data = await res.json();
    setEvents(data.events ?? []);
    setSync(data.sync);
  };

  useEffect(() => { fetchCal(); }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Calendar Sync (27.9)</h1>
      <p className="text-sm text-muted-foreground">Read-only calendar permission, upcoming plans strip, reminders, 3 free slots — providers: google, apple, outlook</p>
      <button onClick={fetchCal} className="px-3 py-1 border rounded text-sm">Load Calendar</button>
      <div className="border rounded-xl p-3 text-sm">
        <div>Provider: {sync?.provider ?? "none"} | Enabled: {sync?.enabled ? "yes" : "no"}</div>
        <div>Free slots: {sync?.freeSlots?.length ?? 0}</div>
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Upcoming ({events.length})</h4>
        {events.slice(0,5).map((e: any) => <div key={e.id} className="border rounded p-2 text-xs"><div className="font-medium">{e.title}</div><div>{new Date(e.startsAt).toLocaleString()} → {new Date(e.endsAt).toLocaleString()} {e.location ? `@ ${e.location}` : ""}</div></div>)}
      </div>
    </div>
  );
}
