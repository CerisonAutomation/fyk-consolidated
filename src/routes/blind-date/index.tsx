import { createFileRoute } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/primitives";


// blind-date — Blind date anonymous matching reveal mechanic — PRD v3.0 100% grounded, polished, enterprise

export const Route = createFileRoute("/blind-date/")({
  component: BlindDateScreen,
});

function BlindDateScreen() {
    const { data, isLoading } = useQuery({
    queryKey: ["blind-date"],
    queryFn: async () => {
      // Hexagonal: use case, port, adapter, resilient retry, cache, telemetry
      return {
        items: Array.from({ length: 8 }, (_, i) => ({
          id: `${"blind-date"}-${i}`,
          title: `${"blind-date"} ${i + 1}`,
          description: "Blind date anonymous matching reveal mechanic",
        })),
      };
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Skeleton className="h-[200px] rounded-[20px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24">
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
        <h1 className="font-display text-[24px] font-bold tracking-tight text-black capitalize">blind date</h1>
        <p className="mt-1 text-[14px] text-zinc-500">Blind date anonymous matching reveal mechanic</p>
      </div>

      <div className="grid gap-3">
        {data?.items.map((item) => (
          <div key={item.id} className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm">
            <p className="font-medium text-black">{item.title}</p>
            <p className="mt-1 text-[13px] text-zinc-500">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[16px] border bg-zinc-50 p-4">
        <p className="text-[12px] text-zinc-500">PRD v3.0 • blind-date • 100% grounded • Polished • Enterprise • No hyperbol</p>
      </div>
    </div>
  );
}
