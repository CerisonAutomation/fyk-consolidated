/**
 * Travel / Passport Mode — Production implementation
 * Allows browsing from a different location while keeping real location private.
 */

export type GeoPoint = { lat: number; lng: number };

export type TravelMode = {
  enabled: boolean;
  homeLocation: GeoPoint | null;
  tripLocation: GeoPoint | null;
  tripCity?: string;
  tripCountry?: string;
  geoMode: "auto" | "manual" | "travel";
  expiresAt?: string | null;
};

export const TRAVEL_CITIES = [
  { city: "Berlin", country: "DE", lat: 52.52, lng: 13.405, district: "Schöneberg" },
  { city: "London", country: "GB", lat: 51.5074, lng: -0.1278, district: "Soho" },
  { city: "New York", country: "US", lat: 40.7128, lng: -74.006, district: "Hell's Kitchen" },
  { city: "Los Angeles", country: "US", lat: 34.0522, lng: -118.2437, district: "West Hollywood" },
  { city: "Paris", country: "FR", lat: 48.8566, lng: 2.3522, district: "Le Marais" },
  { city: "Barcelona", country: "ES", lat: 41.3851, lng: 2.1734, district: "Eixample" },
  { city: "Amsterdam", country: "NL", lat: 52.3676, lng: 4.9041, district: "Centrum" },
  { city: "Sydney", country: "AU", lat: -33.8688, lng: 151.2093, district: "Oxford Street" },
  { city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503, district: "Shinjuku" },
  { city: "Bangkok", country: "TH", lat: 13.7563, lng: 100.5018, district: "Silom" },
  { city: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333, district: "Jardins" },
  { city: "Mexico City", country: "MX", lat: 19.4326, lng: -99.1332, district: "Zona Rosa" },
  { city: "Toronto", country: "CA", lat: 43.6532, lng: -79.3832, district: "Church-Wellesley" },
  { city: "Madrid", country: "ES", lat: 40.4168, lng: -3.7038, district: "Chueca" },
  { city: "Rome", country: "IT", lat: 41.9028, lng: 12.4964, district: "Testaccio" },
] as const;

export type TravelCity = (typeof TRAVEL_CITIES)[number];

export function findNearestTravelCity(point: GeoPoint): TravelCity | null {
  let best: TravelCity | null = null;
  let bestDist = Infinity;
  for (const city of TRAVEL_CITIES) {
    const d = haversineKm(point.lat, point.lng, city.lat, city.lng);
    if (d < bestDist) {
      bestDist = d;
      best = city;
    }
  }
  return best;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveEffectiveLocation(mode: TravelMode): GeoPoint | null {
  if (mode.geoMode === "travel" && mode.tripLocation) {
    return mode.tripLocation;
  }
  if (mode.geoMode === "manual" && mode.homeLocation) {
    return mode.homeLocation;
  }
  return mode.homeLocation;
}

export function isTravelExpired(mode: TravelMode): boolean {
  if (!mode.expiresAt) return false;
  return new Date(mode.expiresAt).getTime() < Date.now();
}

export const TRAVEL_PREMIUM_REQUIRED = true;
export const TRAVEL_MAX_DURATION_DAYS = 30;
