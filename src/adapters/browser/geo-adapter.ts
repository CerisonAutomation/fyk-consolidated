/**
 * Browser LocationService adapter.
 *
 * Wraps navigator.geolocation with the FYK privacy pipeline:
 *   - Snap to a ~250 m grid so exact GPS never leaves the device
 *   - Deterministic per-pair jitter so triangulation is impractical
 *   - Nearest bundled city resolution without reverse-geocoding
 *
 * Implements the LocationService port from core/ports/services.ts.
 */

import type { LocationService } from "../../core/ports/services";
import type { LatLng } from "../../core/domain/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const R_EARTH_KM = 6371.0088;

const CITY_CENTROIDS: Record<string, LatLng & { zoom: number }> = {
  valletta: { lat: 35.8989, lng: 14.5146, zoom: 14 },
  naxxar: { lat: 35.9139, lng: 14.4436, zoom: 14 },
  london: { lat: 51.5072, lng: -0.1276, zoom: 12 },
  berlin: { lat: 52.52, lng: 13.405, zoom: 12 },
  madrid: { lat: 40.4168, lng: -3.7038, zoom: 12 },
  amsterdam: { lat: 52.3676, lng: 4.9041, zoom: 13 },
  nyc: { lat: 40.7128, lng: -74.006, zoom: 12 },
};

// ─── Pure maths ──────────────────────────────────────────────────────────────

/** Haversine distance between two LatLng points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Stable 32-bit hash so the same pair always produces the same jitter. */
export function pairHash(a: string, b: string): number {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Deterministic +/- 0.3 km jitter, applied per viewer/target pair.
 * The same pair always produces the same offset so the distance
 * never drifts between reads (which would leak timing info).
 */
export function jitterKm(viewerId: string, targetId: string, maxKm = 0.3): number {
  return (pairHash(viewerId, targetId) - 0.5) * 2 * maxKm;
}

/** Snap a coordinate to a ~250 m grid so exact GPS never leaves the service layer. */
export function snap(point: LatLng, gridMeters = 250): LatLng {
  const dLat = gridMeters / 111_320;
  const dLng =
    gridMeters /
    (111_320 * Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)));
  return {
    lat: Math.round(point.lat / dLat) * dLat,
    lng: Math.round(point.lng / dLng) * dLng,
  };
}


/**
 * Approximate a position for display purposes.
 * Applies a deterministic per-id offset so repeated reads never drift
 * while keeping the result within ~0.3 km of the real location.
 */
export function approximatePosition(
  id: string,
  distMi: number,
  center?: LatLng,
): LatLng {
  const distKm = distMi * 1.60934;
  const angle = pairHash(id, "display") * Math.PI * 2;
  const jitter = jitterKm(id, "display", 0.3);
  const offsetKm = distKm + jitter;

  const base: LatLng = center ?? CITY_CENTROIDS.valletta;
  return {
    lat: base.lat + (offsetKm * Math.cos(angle)) / 111_320,
    lng:
      base.lng +
      (offsetKm * Math.sin(angle)) /
        (111_320 * Math.cos((base.lat * Math.PI) / 180)),
  };
}

// ─── Service implementation ──────────────────────────────────────────────────

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 120_000,
};

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 60_000,
};

export const browserGeoAdapter: LocationService = {
  /**
   * Ask the device for a single GPS fix, snap it to the grid, and return.
   * Returns null when the browser has no geolocation or the user denies.
   */
  async getCurrentPosition(): Promise<LatLng | null> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const raw: LatLng = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          resolve(snap(raw, 250));
        },
        () => resolve(null),
        GEO_OPTIONS,
      );
    });
  },

  /**
   * Continuous watch, snapped on every tick.
   * Returns a stop function.
   */
  watchPosition(callback: (pos: LatLng) => void): () => void {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return () => {};
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const raw: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        callback(snap(raw, 250));
      },
      () => {},
      WATCH_OPTIONS,
    );

    return () => navigator.geolocation.clearWatch(id);
  },

  /**
   * Resolve a city string to its bundled centroid.
   * No network call -- purely local lookup.
   */
  async geocodeCity(city: string): Promise<LatLng | null> {
    const key = city.toLowerCase().trim();
    const centroid = CITY_CENTROIDS[key];
    return centroid ? { lat: centroid.lat, lng: centroid.lng } : null;
  },

  haversineKm,

  approximatePosition,
};
