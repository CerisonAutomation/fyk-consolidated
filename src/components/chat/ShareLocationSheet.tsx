"use client";
import { useState, useCallback } from "react";
import { MapPin, Navigation, Loader2, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { locate } from "@/lib/geo";
import { Button } from "@/components/ui/primitives";

interface ShareLocationSheetProps {
  onShare: (lat: number, lng: number) => void;
  onClose: () => void;
}

export function ShareLocationSheet({ onShare, onClose }: ShareLocationSheetProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "shared" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);

    try {
      const result = await locate();

      if (result.status === "granted" && result.coords) {
        onShare(result.coords.lat, result.coords.lng);
        setStatus("shared");
        setTimeout(onClose, 900);
      } else if (result.status === "denied") {
        setStatus("error");
        setErrorMsg("Location access was denied. Please enable it in your device settings.");
      } else {
        setStatus("error");
        setErrorMsg("Unable to determine your location. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }, [onShare, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      {/* Backdrop tap to close */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Glass bottom sheet */}
      <div className="relative w-full max-w-lg rounded-t-3xl border border-line/50 bg-surface/95 backdrop-blur-xl px-6 pb-8 pt-6 shadow-2xl"
           style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))" }}>
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted/40" />

        {/* Title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15">
            <MapPin className="h-5 w-5 text-gold" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Share Current Location</h2>
        </div>

        {/* Subtitle */}
        <p className="mb-1 text-sm text-muted">
          Your approximate location will be shared.
        </p>
        <p className="mb-6 text-xs text-muted/60">
          Location is snapped to a 250m grid for privacy.
        </p>

        {/* Status feedback */}
        {status === "shared" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
            <Check className="h-4 w-4" />
            Location shared
          </div>
        )}

        {status === "error" && errorMsg && (
          <div className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleShare}
            disabled={status === "loading"}
            className={cn(
              "w-full gap-2",
              status === "shared" && "bg-emerald-500 text-foreground"
            )}
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Locating...
              </>
            ) : status === "shared" ? (
              <>
                <Check className="h-4 w-4" />
                Shared
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4" />
                Share Location
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={onClose}
            disabled={status === "loading"}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
