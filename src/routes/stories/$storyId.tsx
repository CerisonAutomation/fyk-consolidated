import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, MapPin, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useScreenData } from "@/hooks/useScreenData";

/**
 * Story — reads `/api/stories?id=`.
 *
 * One ephemeral story.
 *
 * This screen used to fetch `/api/$storyId.tsx`, a path built from its own
 * name, and to post every card button to `/api/<screen>/{id}/action`. Neither
 * exists. `#/lib/screen-sources` names the canonical route and the exact body its
 * schema accepts; `#/hooks/useScreenData` and `#/hooks/useScreenAction` do the
 * reading and writing through `#/lib/client`, which carries the bearer token these
 * `auth: "required"` routes need.
 */

export const Route = createFileRoute("/stories/$storyId")({
  component: StoryIdScreen,
});

function StoryIdScreen() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { vibrate } = useHaptics();
  const { isConnected } = useRealtimeSync();

  const { storyId } = Route.useParams();
  const { data, isLoading, error, refetch } = useScreenData("storyDetail", {
    search,
    filter, id: storyId,
  });




  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Skeleton className="h-[200px] rounded-[20px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-[14px] font-medium text-red-800">Failed to load storyId</p>
          <p className="mt-1 text-[12px] text-red-600">{(error as Error).message}</p>
          <button type="button" onClick={() => refetch()} className="mt-4 rounded-full bg-black px-4 py-2 text-[13px] text-white">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24">
      <p className="mb-3 text-[12px] text-zinc-500">Stories expire; reactions belong to the viewer.</p>
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[24px] font-bold tracking-tight text-black capitalize">Story</h1>
            <p className="mt-1 text-[14px] text-zinc-500">One ephemeral story</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-zinc-300")} />
              {isConnected ? "Live" : "Offline"} • {data?.total ?? 0} total
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-24 bg-transparent text-[13px] outline-none md:w-40" />
          </div>
          {["All", "Nearby", "Popular", "Verified"].map((f) => (
            <button type="button" key={f} onClick={() => { setFilter(f); vibrate(10); }} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[13px]", filter === f ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-600")}>{f}</button>
          ))}
        </div>
      </div>

      {data?.items.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
          <p className="text-[14px] font-medium text-zinc-700">No story yet</p>
          <p className="mt-1 text-[12px] text-zinc-500">Reads /api/stories?id=</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {data?.items.map((item) => (
            <div key={item.id} className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-black truncate">{item.name ?? item.title ?? item.id}</p>
                  <p className="mt-1 text-[13px] text-zinc-500 line-clamp-2">{item.description ?? item.title ?? ""}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{tag}</span>
                    ))}
                    {item.verified && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">Verified</span>}
                    {item.boosted && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Boosted</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-zinc-400">
                {item.distance !== undefined && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.distance}m</span>}
                {item.members !== undefined && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {item.members}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-[16px] border bg-zinc-50 p-4">
        <p className="text-[11px] text-zinc-500">Reads /api/stories?id= • nothing to write from here. Refusals are shown as the server words them.</p>
      </div>
    </div>
  );
}
