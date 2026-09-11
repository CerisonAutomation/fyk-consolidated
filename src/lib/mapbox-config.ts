import mapboxgl from "mapbox-gl";

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";

export function getMapboxToken(): string {
  return TOKEN;
}

export function initMapbox(): void {
  if (TOKEN && typeof mapboxgl !== "undefined") {
    mapboxgl.accessToken = TOKEN;
  }
}

export function isMapboxAvailable(): boolean {
  return !!TOKEN && typeof mapboxgl !== "undefined";
}

// Auto-initialize on import
initMapbox();
