"use client";
import { useState, useEffect, useCallback } from "react";
import { Radio, Clock, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/primitives";

interface LiveLocationToggleProps {
  onStart: (durationMs: number) => void;
  onStop: () => void;
  isLive: boolean;
  expiresAt?: number;
}

const DURATION_OPTIONS = [
  { label: "15 minutes", ms: 15 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "8 hours", ms: 8 * 60 * 60 * 1000 },
] as const;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

export function LiveLocationToggle({
  onStart,
  onStop,
  isLive,
  expiresAt,
}: LiveLocationToggleProps) {
  const [selectedMs, setSelectedMs] = useState<number>(DURATION_OPTIONS[1].ms);
  const [remaining, setRemaining] = useState<number>(0);

  // Tick countdown every second while live
  useEffect(() => {
    if (!isLive || !expiresAt) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const r = Math.max(0, expiresAt - Date.now());
      setRemaining(r);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLive, expiresAt]);

  const handleStart = useCallback(() => {
    onStart(selectedMs);
  }, [onStart, selectedMs]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isLive ? "bg-rose-500/15" : "bg-gold/15"
        )}>
          <Radio className={cn("h-4 w-4", isLive ? "text-rose-400" : "text-gold")} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Live Location Sharing</h3>
          <p className="text-xs text-muted">
            {isLive ? "Currently sharing" : "Share your real-time position"}
          </p>
        </div>
      </div>

      {isLive ? (
        /* ---- Active state ---- */
        <div className="space-y-3">
          {/* Pulsing indicator + countdown */}
          <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 px-4 py-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-300">
                Sharing live location
              </p>
              {expiresAt && (
                <p className="text-xs text-rose-400/80 mt-0.5">
                  {formatCountdown(remaining)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onStop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
              aria-label="Stop live location sharing"
            >
              <X size={16} />
            </button>
          </div>

          {/* Privacy note */}
          <p className="text-[11px] text-muted/60">
            Your approximate location updates every 60 seconds.
          </p>

          {/* Stop button */}
          <Button
            variant="danger"
            onClick={onStop}
            className="w-full gap-2"
          >
            <X className="h-4 w-4" />
            Stop Sharing
          </Button>
        </div>
      ) : (
        /* ---- Inactive state ---- */
        <div className="space-y-3">
          {/* Duration chips */}
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.ms}
                type="button"
                onClick={() => setSelectedMs(opt.ms)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                  selectedMs === opt.ms
                    ? "border-gold/50 bg-gold/15 text-gold-soft shadow-sm"
                    : "border-line bg-surface-2 text-muted hover:text-foreground hover:border-line/80"
                )}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {opt.label}
                </div>
              </button>
            ))}
          </div>

          {/* Start button */}
          <Button
            onClick={handleStart}
            className="w-full gap-2 bg-gold text-black hover:bg-gold-soft"
          >
            <Radio className="h-4 w-4" />
            Start Sharing
          </Button>

          {/* Privacy note */}
          <p className="text-[11px] text-muted/60 text-center">
            Your approximate location updates every 60 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
