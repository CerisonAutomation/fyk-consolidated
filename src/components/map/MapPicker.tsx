"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getMapboxToken } from "#/lib/mapbox-config";
import { reverseGeocode } from "#/lib/geocoding";
import { cn } from "#/utils/cn";
import { MapPin, X, Check, Navigation } from "lucide-react";

interface MapPickerProps {
  initialPosition?: { lat: number; lng: number };
  onPick: (latlng: { lat: number; lng: number }, label?: string) => void;
  onCancel: () => void;
  height?: number;
}

const DEFAULT_CENTER: [number, number] = [14.5146, 35.8989]; // Valletta

export function MapPicker({
  initialPosition,
  onPick,
  onCancel,
  height,
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [label, setLabel] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(
    initialPosition ?? null,
  );

  // ---------------------------------------------------------------------------
  // Initialise map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = getMapboxToken();
    if (!token) return;

    mapboxgl.accessToken = token;

    const start: [number, number] = initialPosition
      ? [initialPosition.lng, initialPosition.lat]
      : DEFAULT_CENTER;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: start,
      zoom: initialPosition ? 14 : 12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      placeMarker(lat, lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Place / move marker + reverse-geocode
  // ---------------------------------------------------------------------------
  const placeMarker = useCallback(
    async (lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map) return;

      // Create or reposition marker
      if (!markerRef.current) {
        const el = document.createElement("div");
        el.className = "map-picker-marker";
        el.innerHTML = `<div style="width:32px;height:32px;background:gold;border-radius:50%;border:3px solid #000;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;

        markerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }

      setMarkerPos({ lat, lng });
      setLabel(null);
      setGeocoding(true);

      try {
        const result = await reverseGeocode(lat, lng);
        if (result) {
          const parts = [result.address, result.city, result.country].filter(Boolean);
          setLabel(parts.join(", ") || result.name || null);
        }
      } finally {
        setGeocoding(false);
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Attempt geolocation on mount when no initialPosition
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (initialPosition) return;

    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
        placeMarker(lat, lng);
      },
      () => {
        // Silently ignore — stay on default center
      },
    );
  }, [initialPosition, placeMarker]);

  // ---------------------------------------------------------------------------
  // Re-centre on GPS
  // ---------------------------------------------------------------------------
  const handleUseMyLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
        placeMarker(lat, lng);
      },
      () => {
        // Silently ignore
      },
    );
  }, [placeMarker]);

  // ---------------------------------------------------------------------------
  // Confirm pick
  // ---------------------------------------------------------------------------
  const handleConfirm = useCallback(() => {
    if (markerPos) {
      onPick(markerPos, label ?? undefined);
    }
  }, [markerPos, label, onPick]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
      {/* Map area */}
      <div
        ref={containerRef}
        className="flex-1 w-full"
        style={{ minHeight: height ?? "60vh" }}
      />

      {/* Address card — floats above the bottom bar */}
      {markerPos && (
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

      {/* Use my location button */}
      <button
        type="button"
        onClick={handleUseMyLocation}
        className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-surface/95 backdrop-blur-xl border border-line rounded-full px-3 py-1.5 text-xs text-primary hover:bg-surface transition-colors shadow-md"
      >
        <Navigation size={14} />
        My location
      </button>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-4 bg-surface border-t border-line"
           style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/20 text-secondary hover:bg-muted/30 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Label */}
        <div className="flex-1 text-center px-3 truncate text-sm text-secondary">
          {markerPos
            ? geocoding
              ? "Resolving..."
              : (label || "Tap map to place pin")
            : "Tap map to place pin"}
        </div>

        {/* Confirm */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!markerPos}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors shadow-md",
            markerPos
              ? "bg-gold text-black hover:brightness-110"
              : "bg-muted/30 text-muted cursor-not-allowed",
          )}
        >
          <Check size={16} />
          Share
        </button>
      </div>
    </div>
  );
}
