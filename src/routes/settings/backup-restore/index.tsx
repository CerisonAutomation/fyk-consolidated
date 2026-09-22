import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/primitives";

export const Route = createFileRoute("/settings/backup-restore/")({
  component: BackupRestoreScreen,
});

function BackupRestoreScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ["backup-restore"],
    queryFn: async () => ({
      items: Array.from({ length: 6 }, (_, i) => ({
        id: `${"backup-restore"}-${i}`,
        title: `${"backup-restore"} ${i + 1}`,
        description: "Backup restore with export, import, encryption",
      })),
    }),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl p-4"><Skeleton className="h-[200px] rounded-[20px]" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24">
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
        <h1 className="font-display text-[24px] font-bold tracking-tight text-black capitalize">backup restore</h1>
        <p className="mt-1 text-[14px] text-zinc-500">Backup restore with export, import, encryption</p>
      </div>
      <div className="grid gap-3">
        {data?.items.map((item) => (
          <div key={item.id} className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm">
            <p className="font-medium text-black">{item.title}</p>
            <p className="mt-1 text-[13px] text-zinc-500">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
