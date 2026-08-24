import { useState, useCallback, type ReactNode } from "react";
import { Crosshair } from "lucide-react";

interface LocateMeButtonProps {
  onLocate: (coords: { lat: number; lon: number }) => void;
  /** Function to request the user's current location */
  requestLocation?: () => Promise<{ lat: number; lon: number }>;
  className?: string;
}

export function LocateMeButton({
  onLocate,
  requestLocation,
  className,
}: LocateMeButtonProps): ReactNode {
  const [locating, setLocating] = useState(false);

  const locate = useCallback(async () => {
    if (!requestLocation) return;
    setLocating(true);
    try {
      const coords = await requestLocation();
      onLocate(coords);
    } catch {
      // Location request failed - parent should handle via requestLocation error
    } finally {
      setLocating(false);
    }
  }, [onLocate, requestLocation]);

  return (
    <div
      className={
        className ??
        "absolute right-2 bottom-6 z-[1010] rounded-full"
      }
    >
      <button
        type="button"
        aria-label="Locate me"
        disabled={locating}
        onClick={locate}
        className="inline-flex size-12 items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-neutral-100 disabled:opacity-50"
      >
        <Crosshair className="size-6" fill="currentColor" />
      </button>
    </div>
  );
}
