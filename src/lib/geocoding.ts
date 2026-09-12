/**
 * Mapbox geocoding service — wraps the Search Box and Geocoding v5 APIs
 * for address autocomplete, reverse geocoding, category search, and directions.
 *
 * All coordinates returned are raw Mapbox results — the caller is responsible
 * for running them through snap()/fuzzPin() before display.
 */

import { getMapboxToken, isMapboxAvailable } from "./mapbox-config";

const SEARCH_BASE = "https://api.mapbox.com/search/searchbox/v1";
const GEOCODING_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const DIRECTIONS_BASE = "https://api.mapbox.com/directions/v5/mapbox";

type LatLng = { lat: number; lng: number };

export interface GeocodingFeature {
  id: string;
  name: string;
  address?: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number];
  properties: Record<string, unknown>;
  context?: Array<{ id: string; text: string; short_code?: string }>;
}

export interface DirectionRoute {
  geometry: unknown;
  distance: number; // meters
  duration: number; // seconds
  steps?: Array<{
    maneuver: { type: string; modifier?: string; location: [number, number] };
    name: string;
    distance: number;
    duration: number;
    instruction: string;
  }>;
}

export type DirectionProfile = "walking" | "driving-traffic" | "driving" | "cycling";

// ---------------------------------------------------------------------------
// Forward geocoding (text → coordinates) via Search Box /forward
// ---------------------------------------------------------------------------

export async function searchPlaces(
  query: string,
  proximity?: LatLng,
  options?: { limit?: number; country?: string; types?: string },
): Promise<GeocodingFeature[]> {
  if (!isMapboxAvailable() || !query.trim()) return [];

  const params = new URLSearchParams({
    q: query.trim(),
    access_token: getMapboxToken(),
    auto_complete: "true",
    language: "en",
    limit: String(options?.limit ?? 5),
  });
  if (proximity) params.set("proximity", `${proximity.lng},${proximity.lat}`);
  if (options?.country) params.set("country", options.country);
  if (options?.types) params.set("types", options.types);

  try {
    const res = await fetch(`${SEARCH_BASE}/forward?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: Record<string, unknown>) => ({
      id: String(f.id ?? ""),
      name: String((f.properties as Record<string, unknown>)?.name ?? f.text ?? ""),
      address: String((f.properties as Record<string, unknown>)?.address ?? ""),
      place_name: String(f.place_name ?? (f.properties as Record<string, unknown>)?.full_address ?? ""),
      center: (f.center ?? (f.geometry as Record<string, unknown>)?.coordinates ?? [0, 0]) as [number, number],
      bbox: f.bbox as [number, number, number, number] | undefined,
      properties: (f.properties ?? {}) as Record<string, unknown>,
      context: f.context as GeocodingFeature["context"],
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Reverse geocoding (coordinates → address)
// ---------------------------------------------------------------------------

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ name: string; address: string; city: string; country: string } | null> {
  if (!isMapboxAvailable()) return null;

  try {
    const res = await fetch(
      `${GEOCODING_BASE}/${lng},${lat}.json?access_token=${getMapboxToken()}&types=place,locality,neighborhood,address&language=en`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    const ctx = feature.context ?? [];
    const city = ctx.find((c: { id: string }) => c.id.startsWith("place"))?.text ?? "";
    const country = ctx.find((c: { id: string }) => c.id.startsWith("country"))?.text ?? "";

    return {
      name: feature.text ?? "",
      address: feature.place_name ?? "",
      city,
      country,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Category POI search ("coffee shops near me")
// ---------------------------------------------------------------------------

export async function searchCategory(
  categoryId: string,
  proximity: LatLng,
  options?: { radius?: number; limit?: number; openNow?: boolean },
): Promise<GeocodingFeature[]> {
  if (!isMapboxAvailable()) return [];

  const params = new URLSearchParams({
    access_token: getMapboxToken(),
    proximity: `${proximity.lng},${proximity.lat}`,
    language: "en",
    limit: String(options?.limit ?? 10),
  });
  if (options?.radius) params.set("radius", String(options.radius));
  if (options?.openNow) params.set("open_now", "true");

  try {
    const res = await fetch(`${SEARCH_BASE}/category/${categoryId}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: Record<string, unknown>) => ({
      id: String(f.id ?? ""),
      name: String((f.properties as Record<string, unknown>)?.name ?? f.text ?? ""),
      address: String((f.properties as Record<string, unknown>)?.address ?? ""),
      place_name: String(f.place_name ?? (f.properties as Record<string, unknown>)?.full_address ?? ""),
      center: (f.center ?? (f.geometry as Record<string, unknown>)?.coordinates ?? [0, 0]) as [number, number],
      bbox: f.bbox as [number, number, number, number] | undefined,
      properties: (f.properties ?? {}) as Record<string, unknown>,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Directions (walking, driving, cycling)
// ---------------------------------------------------------------------------

export async function getDirections(
  origin: LatLng,
  destination: LatLng,
  profile: DirectionProfile = "walking",
): Promise<DirectionRoute | null> {
  if (!isMapboxAvailable()) return null;

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({
    access_token: getMapboxToken(),
    steps: "true",
    geometries: "geojson",
    overview: "full",
  });

  try {
    const res = await fetch(`${DIRECTIONS_BASE}/${profile}/${coords}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0] as Record<string, unknown> | undefined;
    if (!route) return null;

    return {
      geometry: route.geometry,
      distance: route.distance as number,
      duration: route.duration as number,
      steps: ((route.legs as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.steps as DirectionRoute["steps"],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// City name resolution (replaces hardcoded nearestCity)
// ---------------------------------------------------------------------------

export async function resolveCityName(lat: number, lng: number): Promise<string | null> {
  const result = await reverseGeocode(lat, lng);
  return result?.city || null;
}

// ---------------------------------------------------------------------------
// Mapbox Static Images API (for chat message previews)
// ---------------------------------------------------------------------------

export function getStaticMapUrl(
  lat: number,
  lng: number,
  options?: { width?: number; height?: number; zoom?: number; pinColor?: string },
): string | null {
  const token = getMapboxToken();
  if (!token) return null;

  const w = options?.width ?? 300;
  const h = options?.height ?? 200;
  const z = options?.zoom ?? 15;
  const color = options?.pinColor ?? "gold";

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+${color}(${lng},${lat})/${lng},${lat},${z}/${w}x${h}@2x?access_token=${token}`;
}

// ---------------------------------------------------------------------------
// Utility: format distance/duration for directions
// ---------------------------------------------------------------------------

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
