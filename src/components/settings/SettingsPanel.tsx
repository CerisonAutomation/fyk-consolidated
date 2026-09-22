/**
 * SettingsPanel — Canonical settings, discreet icon, app lock, privacy report
 * Professional naming, no emoji slop, clean architecture
 */

import { useState } from "react";
import { useAppConfig } from "#/hooks/app-hooks";

const ICONS = [
  { id: "default", label: "FYK" },
  { id: "calculator", label: "Calculator" },
  { id: "notes", label: "Notes" },
  { id: "weather", label: "Weather" },
  { id: "calendar", label: "Calendar" },
  { id: "health", label: "Health" },
  { id: "music", label: "Music" },
  { id: "news", label: "News" },
];

export function SettingsPanel() {
  const { discreetIcon, discreetEnabled, appLockEnabled, appLockTimeoutSec, setDiscreetIcon, setDiscreetEnabled, setAppLock } = useAppConfig();
  const [pin, setPin] = useState("");

  return (
    <div className="space-y-6 p-4">
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold mb-3">Discreet Icon</h3>
        <p className="text-sm text-muted-foreground mb-3">Change app icon to hide in plain sight</p>
        <div className="grid grid-cols-4 gap-2">
          {ICONS.map((icon) => (
            <button
              key={icon.id}
              onClick={() => setDiscreetIcon(icon.id)}
              className={`p-3 rounded-lg border text-center ${discreetIcon === icon.id ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <div className="text-xs mt-1">{icon.label}</div>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-3">
          <input type="checkbox" checked={discreetEnabled} onChange={(e) => setDiscreetEnabled(e.target.checked)} />
          <span className="text-sm">Enable discreet mode</span>
        </label>
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="font-semibold mb-3">App Lock</h3>
        <label className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={appLockEnabled} onChange={(e) => setAppLock({ appLockEnabled: e.target.checked })} />
          <span className="text-sm">Enable PIN lock</span>
        </label>
        {appLockEnabled && (
          <>
            <input
              type="password"
              placeholder="4-8 digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-2 border rounded mb-2"
              maxLength={8}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm">Timeout:</span>
              <select
                value={appLockTimeoutSec}
                onChange={(e) => setAppLock({ appLockTimeoutSec: parseInt(e.target.value) })}
                className="border rounded p-1"
              >
                <option value={30}>30s</option>
                <option value={60}>1 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
              </select>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="font-semibold mb-2">Privacy Report</h3>
        <p className="text-sm text-muted-foreground">Monthly digest: profile views, blocks, data usage</p>
        <button className="mt-2 px-3 py-1 bg-primary text-white rounded text-sm">Generate Report</button>
      </div>
    </div>
  );
}

export function MultiAccountSwitcher() {
  const { accounts, currentAccountId, switchAccount } = require("#/lib/stores/app-stores").useMultiAccountStore();
  return (
    <div className="p-4 border rounded-xl">
      <h3 className="font-semibold mb-3">Multi-Account — {accounts.length}/5</h3>
      <div className="space-y-2">
        {accounts.map((acc: { accountId: string; displayName: string; email: string }) => (
          <button
            key={acc.accountId}
            onClick={() => switchAccount(acc.accountId)}
            className={`w-full p-2 rounded flex items-center gap-2 ${currentAccountId === acc.accountId ? "bg-primary/10 border border-primary" : "border"}`}
          >
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="text-left">
              <div className="text-sm font-medium">{acc.displayName}</div>
              <div className="text-xs text-muted-foreground">{acc.email}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
