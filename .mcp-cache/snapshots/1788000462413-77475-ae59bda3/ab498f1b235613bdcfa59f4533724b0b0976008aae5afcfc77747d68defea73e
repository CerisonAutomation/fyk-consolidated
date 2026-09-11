import { useState, useCallback, useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../cn";

interface PinPosition {
  lat: number;
  lon: number;
  zoom: number;
}

interface LocationChooserProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (submission: {
    geohash: string;
    autoUpdateLocation: boolean;
  }) => void;
  initialPinPos?: PinPosition;
  /** Whether GPS is available on this platform */
  gpsAvailable?: boolean;
  /** Whether auto-update location is enabled */
  autoUpdateLocation?: boolean;
  /** Called when auto-update toggle changes */
  onAutoUpdateChange?: (enabled: boolean) => void;
  className?: string;
}

function encodeGeohash(lat: number, lon: number, precision = 9): string {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let minLat = -90;
  let maxLat = 90;
  let minLon = -180;
  let maxLon = 180;
  let geohash = "";
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    if (bit % 2 === 0) {
      const mid = (minLon + maxLon) / 2;
      if (lon >= mid) {
        ch |= 1 << (4 - (bit % 5));
        minLon = mid;
      } else {
        maxLon = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - (bit % 5));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    bit++;
    if (bit % 5 === 0) {
      geohash += BASE32[ch];
      ch = 0;
    }
  }

  return geohash;
}

export function LocationChooser({
  open,
  onClose,
  onSubmit,
  initialPinPos,
  gpsAvailable = false,
  autoUpdateLocation = false,
  onAutoUpdateChange,
  className,
}: LocationChooserProps): ReactNode {
  const [pinPos] = useState<PinPosition | null>(
    initialPinPos ?? null,
  );

  const handleSubmit = useCallback(() => {
    if (!pinPos) return;
    const geohash = encodeGeohash(pinPos.lat, pinPos.lon);
    onSubmit({ geohash, autoUpdateLocation });
    onClose();
  }, [pinPos, autoUpdateLocation, onSubmit, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center sm:items-center",
        className,
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-t-2xl border border-border bg-background shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">Choose location</h2>
            <p className="text-sm text-muted-foreground">
              Drag the map to place the pin where you want to browse from.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Map placeholder */}
        <div className="flex h-80 items-center justify-center bg-muted text-muted-foreground">
          <p className="text-sm">
            Map component goes here (requires Mapbox/Leaflet integration)
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          {gpsAvailable && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoUpdateLocation}
                onChange={(e) => onAutoUpdateChange?.(e.target.checked)}
                className="size-4 rounded accent-primary"
              />
              <span className="truncate py-1">
                Update automatically using GPS
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!pinPos}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
