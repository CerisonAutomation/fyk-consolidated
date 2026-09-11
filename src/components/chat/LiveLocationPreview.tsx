"use client";
import { useState, useEffect } from "react";
import { Navigation } from "lucide-react";
import { getStaticMapUrl } from "#/lib/geocoding";
import { haversineKm, displayDistance } from "#/lib/geo";

interface LiveLocationPreviewProps {
  lat: number;
  lng: number;
  isLive?: boolean;
  expiresAt?: number;
  userLat?: number;
  userLng?: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

export function LiveLocationPreview({
  lat,
  lng,
  isLive = false,
  expiresAt,
  userLat,
  userLng,
}: LiveLocationPreviewProps) {
  const [remaining, setRemaining] = useState<number>(0);

  // Countdown for live sessions
  useEffect(() => {
    if (!isLive || !expiresAt) return;

    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLive, expiresAt]);

  const mapUrl = getStaticMapUrl(lat, lng, {
    width: 300,
    height: 150,
    zoom: 15,
    pinColor: isLive ? "ff4444" : "gold",
  });

  // Distance from viewer to pin
  let distanceText: string | null = null;
  if (userLat != null && userLng != null) {
    const km = haversineKm({ lat: userLat, lng: userLng }, { lat, lng });
    distanceText = displayDistance(km);
  }

  // Directions URL
  const directionsUrl =
    userLat != null && userLng != null
      ? `https://www.mapbox.com/directions/?origin=${userLng},${userLat}&destination=${lng},${lat}`
      : null;

  return (
    <div className="inline-flex flex-col rounded-xl border border-line bg-surface overflow-hidden max-w-[320px]">
      {/* Map image */}
      <div className="relative">
        {mapUrl ? (
          <img
            src={mapUrl}
            alt="Location map"
            width={300}
            height={150}
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[150px] w-[300px] items-center justify-center bg-surface-2 text-xs text-muted">
            Map unavailable
          </div>
        )}

        {/* Live pulsing dot overlay */}
        {isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-sm px-2 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <span className="text-[10px] font-medium text-rose-300">
              {expiresAt ? formatCountdown(remaining) : "LIVE"}
            </span>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-surface">
        <div className="min-w-0 flex-1">
          {distanceText && (
            <p className="text-xs font-medium text-white truncate">{distanceText} away</p>
          )}
          {!distanceText && isLive && (
            <p className="text-xs text-muted">
              {expiresAt ? formatCountdown(remaining) : "Live location"}
            </p>
          )}
        </div>

        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-medium text-gold-soft hover:bg-gold/25 transition-colors shrink-0"
          >
            <Navigation className="h-3 w-3" />
            Directions
          </a>
        )}
      </div>
    </div>
  );
}
