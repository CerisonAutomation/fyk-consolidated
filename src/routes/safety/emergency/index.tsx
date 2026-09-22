import { createFileRoute } from "@tanstack/react-router";
import { EmergencySharePanel, RateLimitPanel, DeletionPanel } from "@/components/settings/SafetyGrowthPanel";

export const Route = createFileRoute("/safety/emergency/")({
  component: SafetyEmergencyPage,
});

function SafetyEmergencyPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Safety Center</h1>
      <p className="text-sm text-muted-foreground">Emergency share via SMS, rate limiting, and account deletion with grace period — production with DB and Twilio</p>
      <EmergencySharePanel />
      <RateLimitPanel />
      <DeletionPanel />
    </div>
  );
}
