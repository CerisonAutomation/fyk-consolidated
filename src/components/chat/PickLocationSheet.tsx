"use client";
import { useState, useCallback, useRef } from "react";
import { X, Check, MapPin } from "lucide-react";
import { cn } from "@/utils/cn";
import { reverseGeocode } from "@/lib/geocoding";
import { Button } from "@/components/ui/primitives";
import { MapSearchBar } from "@/components/map/MapSearchBar";
import { MapPicker } from "@/components/map/MapPicker";

interface PickLocationSheetProps {
  onShare: (lat: number, lng: number, label?: string) => void;
  onClose: () => void;
}

export function PickLocationSheet({ onShare, onClose }: PickLocationSheetProps) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const resolveLabel = useCallback(async (lat: number, lng: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLabel(null);
    setGeocoding(true);
    try {
      const result = await reverseGeocode(lat, lng);
      if (controller.signal.aborted) return;
      if (result) {
        const parts = [result.address, result.city, result.country].filter(Boolean);
        setLabel(parts.join(", ") || result.name || null);
      }
    } finally {
      if (!controller.signal.aborted) setGeocoding(false);
    }
  }, []);

  const handlePick = useCallback(
    (latlng: { lat: number; lng: number }, existingLabel?: string) => {
      setPicked(latlng);
      if (existingLabel) {
        setLabel(existingLabel);
      } else {
        resolveLabel(latlng.lat, latlng.lng);
      }
    },
    [resolveLabel],
  );

  const handleSearchSelect = useCallback(
    (feature: { center: [number, number]; place_name: string }) => {
      const [lng, lat] = feature.center;
      setPicked({ lat, lng });
      setLabel(feature.place_name || null);
    },
    [],
  );

  const handleShare = useCallback(() => {
    if (picked) {
      onShare(picked.lat, picked.lng, label ?? undefined);
    }
  }, [picked, label, onShare]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
      {/* Search bar */}
      <div className="relative z-10 px-4 pt-4 pb-2 bg-surface/95 backdrop-blur-xl border-b border-line/50"
           style={{ paddingTop: "calc(16px + env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-gold shrink-0" />
          <h2 className="text-sm font-semibold text-foreground">Pick a location</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-muted/20 text-secondary hover:bg-muted/30 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <MapSearchBar
          placeholder="Search address..."
          onSelect={handleSearchSelect}
        />
      </div>

      {/* Map fills remaining space */}
      <div className="flex-1 relative">
        <MapPicker
          onPick={handlePick}
          onCancel={onClose}
        />

        {/* Address label overlay */}
        {picked && (
          <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
               style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px) + 16px)" }}>
            <div className="bg-surface/95 backdrop-blur-xl border border-line rounded-xl px-4 py-2.5 shadow-lg max-w-sm text-center">
              {geocoding ? (
                <span className="text-sm text-muted flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-gold border-t-transparent animate-spin" />
                  Resolving address...
                </span>
              ) : (
                <span className="text-sm text-primary">
                  {label || "Unknown location"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-4 bg-surface border-t border-line"
           style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <Button
          variant="ghost"
          onClick={onClose}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>

        <Button
          onClick={handleShare}
          disabled={!picked}
          className={cn(
            "gap-1.5",
            picked ? "bg-gold text-black" : "opacity-50 cursor-not-allowed"
          )}
        >
          <Check className="h-4 w-4" />
          Share
        </Button>
      </div>
    </div>
  );
}
