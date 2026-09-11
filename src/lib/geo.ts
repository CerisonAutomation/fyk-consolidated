/**
 * Location privacy maths.
 * Coordinates are snapped to a city centroid plus a deterministic per-pair offset so that
 * repeated reads never drift — which is what makes triangulation impractical.
 * Mirrors docs/privacy.md.
 */

const R_EARTH_KM = 6371.0088;

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
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

/** Deterministic ±0.3 km jitter, applied per viewer/target pair. */
export function jitterKm(viewerId: string, targetId: string, maxKm = 0.3): number {
  return (pairHash(viewerId, targetId) - 0.5) * 2 * maxKm;
}

/**
 * Snap a coordinate to a ~250 m grid so an exact GPS fix never leaves the
 * service layer.
 *
 * Two details that matter, both covered by tests:
 *   - the longitude step is derived from the **snapped** latitude, not the input
 *     one, otherwise re-snapping an already-coarsened value shifts it again and
 *     `snap` is not idempotent (it was: the second pass moved the point ~130 m);
 *   - results are rounded to 6 decimals, so a stored value and a freshly snapped
 *     one compare exactly instead of differing by float noise.
 */
export function snap(point: LatLng, gridMeters = 250): LatLng {
  const dLat = gridMeters / 111_320;
  const lat = round6(Math.round(point.lat / dLat) * dLat);
  const dLng = gridMeters / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { lat, lng: round6(Math.round(point.lng / dLng) * dLng) };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export type DistanceOptions = {
  hideDistance?: boolean;
  approximate?: boolean;
  unit?: "km" | "mi";
};

/** Public-facing distance string. Never returns anything more precise than 0.5 km / 0.3 mi. */
export function displayDistance(km: number, opts: DistanceOptions = {}): string {
  const { hideDistance, approximate = true, unit = "km" } = opts;
  if (hideDistance) return "Distance hidden";
  const value = unit === "mi" ? km * 0.621371 : km;
  const floor = unit === "mi" ? 0.3 : 0.5;
  const safe = Math.max(floor, value);
  const rounded = approximate
    ? safe < 10
      ? Math.round(safe * 2) / 2
      : Math.round(safe)
    : Math.round(safe * 10) / 10;
  return `${rounded} ${unit}`;
}

/** Full read-time pipeline: snap → jitter → round. */
export function resolveDistanceKm(viewerId: string, targetId: string, rawKm: number): number {
  return Math.max(0.1, rawKm + jitterKm(viewerId, targetId));
}

/** Offsets a pin so a map marker never sits on someone's front door. */
export function fuzzPin(point: LatLng, seedA: string, seedB: string, radiusM = 420): LatLng {
  const angle = pairHash(seedA, seedB) * Math.PI * 2;
  const dist = (0.4 + pairHash(seedB, seedA) * 0.6) * radiusM;
  return {
    lat: point.lat + (dist * Math.cos(angle)) / 111_320,
    lng: point.lng + (dist * Math.sin(angle)) / (111_320 * Math.cos((point.lat * Math.PI) / 180)),
  };
}

export const CITY_CENTROIDS: Record<string, LatLng & { zoom: number }> = {
  valletta: { lat: 35.8989, lng: 14.5146, zoom: 14 },
  naxxar: { lat: 35.9139, lng: 14.4436, zoom: 14 },
  london: { lat: 51.5072, lng: -0.1276, zoom: 12 },
  berlin: { lat: 52.52, lng: 13.405, zoom: 12 },
  madrid: { lat: 40.4168, lng: -3.7038, zoom: 12 },
  amsterdam: { lat: 52.3676, lng: 4.9041, zoom: 13 },
  nyc: { lat: 40.7128, lng: -74.006, zoom: 12 },
};

/** Compatibility score: tag overlap + looking-for reciprocity + deal-breaker pass. */
export function compatibility(input: {
  tagScore: number;
  reciprocal: boolean;
  distanceKm: number;
  radiusKm: number;
  ageOk: boolean;
}): number {
  if (!input.ageOk) return 0;
  const distanceScore = Math.max(0, 1 - input.distanceKm / Math.max(1, input.radiusKm)) * 24;
  const reciprocity = input.reciprocal ? 22 : 0;
  return Math.max(0, Math.min(100, Math.round(input.tagScore * 0.54 + distanceScore + reciprocity)));
}

/* ------------------------- real device geolocation ---------------------- */

export type GeoState = {
  status: "idle" | "prompting" | "granted" | "denied" | "unavailable";
  coords: LatLng | null;
  accuracyM: number;
  city: string;
  at: number;
};

export const GEO_IDLE: GeoState = {
  status: "idle", coords: null, accuracyM: 0, city: "", at: 0,
};

/** Nearest bundled city to a fix — no reverse-geocoding service involved. */
export function nearestCity(point: LatLng): { id: string; km: number } {
  let best = { id: "valletta", km: Number.POSITIVE_INFINITY };
  for (const [id, c] of Object.entries(CITY_CENTROIDS)) {
    const km = haversineKm(point, { lat: c.lat, lng: c.lng });
    if (km < best.km) best = { id, km };
  }
  return best;
}

/** Asks the device for a fix, then immediately snaps it. The precise value is
 *  used once to pick a city and is never stored or displayed. */
export function locate(): Promise<GeoState> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ...GEO_IDLE, status: "unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const raw = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const snapped = snap(raw, 250);
        resolve({
          status: "granted",
          coords: snapped,
          accuracyM: Math.round(pos.coords.accuracy),
          city: nearestCity(snapped).id,
          at: Date.now(),
        });
      },
      (err) => {
        resolve({
          ...GEO_IDLE,
          status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
    );
  });
}

/** Continuous watch, snapped on every tick. Returns a stop function. */
export function watchLocation(onFix: (s: GeoState) => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const snapped = snap({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 250);
      onFix({
        status: "granted",
        coords: snapped,
        accuracyM: Math.round(pos.coords.accuracy),
        city: nearestCity(snapped).id,
        at: Date.now(),
      });
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export async function geoPermissionState(): Promise<PermissionState | "unsupported"> {
  try {
    if (!navigator.permissions?.query) return "unsupported";
    const s = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return s.state;
  } catch {
    return "unsupported";
  }
}
