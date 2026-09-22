import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/settings/stats/")({
  component: StatsPage,
});

function StatsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/stats");
      const json = await res.json();
      setData(json);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Stats Dashboard (27.8)</h1>
      <p className="text-sm text-muted-foreground">Private analytics: views, like/match rate, reply rate, best photo, best reply time</p>
      <button onClick={fetchStats} disabled={loading} className="px-3 py-1 border rounded text-sm">Refresh Stats</button>
      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded p-3 text-center"><div className="text-2xl font-bold">{data.stats?.viewsTotal ?? 0}</div><div className="text-xs">Total Views</div></div>
            <div className="border rounded p-3 text-center"><div className="text-2xl font-bold">{data.stats?.viewsUnique ?? 0}</div><div className="text-xs">Unique</div></div>
            <div className="border rounded p-3 text-center"><div className="text-2xl font-bold">{data.stats?.likesReceived ?? 0}</div><div className="text-xs">Likes Received</div></div>
            <div className="border rounded p-3 text-center"><div className="text-2xl font-bold">{Math.round((data.stats?.replyRate ?? 0)*100)}%</div><div className="text-xs">Reply Rate</div></div>
          </div>
          <div className="border rounded-xl p-3">
            <h4 className="font-semibold text-sm mb-2">Insights</h4>
            {data.insights?.map((ins: string, i: number) => <div key={i} className="text-xs py-1 border-b last:border-0">{ins}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
