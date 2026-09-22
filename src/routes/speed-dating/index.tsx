import { createFileRoute } from "@tanstack/react-router";
import { SpeedDatingPanel } from "#/components/settings/SafetyGrowthPanel";

export const Route = createFileRoute("/speed-dating/")({
  component: SpeedDatingPage,
});

function SpeedDatingPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Speed Dating</h1>
      <p className="text-sm text-muted-foreground">Scheduled video rounds with queue and mutual match detection</p>
      <SpeedDatingPanel />
    </div>
  );
}
