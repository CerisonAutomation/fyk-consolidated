/**
 * @deprecated Use src/components/settings/SafetyGrowthPanel.tsx — canonical source
 */
export * from "../settings/SafetyGrowthPanel";
export function DivinePanels() {
  const { EmergencySharePanel, RateLimitPanel, DeletionPanel, ConsumablesPanel, PromoPanel, GrowthPanel, SpeedDatingPanel } =
    require("../settings/SafetyGrowthPanel");
  return (
    <div className="space-y-4 p-4">
      <EmergencySharePanel />
      <RateLimitPanel />
      <DeletionPanel />
      <ConsumablesPanel />
      <PromoPanel />
      <GrowthPanel />
      <SpeedDatingPanel />
    </div>
  );
}
