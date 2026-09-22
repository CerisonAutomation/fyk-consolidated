import { createFileRoute } from "@tanstack/react-router";
import { SettingsPanel, MultiAccountSwitcher } from "@/components/settings/SettingsPanel";

export const Route = createFileRoute("/settings/app-config/")({
  component: AppConfigPage,
});

function AppConfigPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">App Configuration</h1>
      <p className="text-sm text-muted-foreground">Discreet icon, app lock, pause mode, widget, multi-account — persisted in DB</p>
      <SettingsPanel />
      <MultiAccountSwitcher />
    </div>
  );
}
