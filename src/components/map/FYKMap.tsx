"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LatLng } from "@/lib/geo";
import { getMapboxToken, isMapboxAvailable } from "@/lib/mapbox-config";
import { cn } from "@/utils/cn";
import { MapPinMarker } from "./MapPinMarker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapPinItem {
	id: string;
	lat: number;
	lng: number;
	label?: string;
	photo?: string;
	online?: boolean;
	accent?: boolean;
	emoji?: string;
}

interface FYKMapProps {
	center?: LatLng;
	zoom?: number;
	pins: MapPinItem[];
	userPosition?: LatLng;
	height?: number;
	interactive?: boolean;
	onSelect?: (id: string) => void;
	onMapClick?: (latlng: LatLng) => void;
	showPrivacyHalos?: boolean;
	className?: string;
	style?: "dark" | "satellite";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: LatLng = { lat: 35.8989, lng: 14.5146 }; // Valletta
const DEFAULT_ZOOM = 13;
const DEFAULT_HEIGHT = 420;
const TILE_TIMEOUT_MS = 6_000;
const HIT_RADIUS_PX = 30;

const MAP_STYLES: Record<string, string> = {
	dark: "mapbox://styles/mapbox/dark-v11",
	satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FYKMap({
	center,
	zoom,
	pins,
	userPosition,
	height = DEFAULT_HEIGHT,
	interactive = true,
	onSelect,
	onMapClick,
	showPrivacyHalos = true,
	className,
	style = "dark",
}: FYKMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
	const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

	const [failed, setFailed] = useState(false);
	const [ready, setReady] = useState(false);

	const centre = center ?? DEFAULT_CENTER;
	const currentZoom = zoom ?? DEFAULT_ZOOM;

	// ---------------------------------------------------------------------------
	// Initialise Mapbox GL JS map
	// ---------------------------------------------------------------------------
	useEffect(() => {
		const host = containerRef.current;
		if (!host || mapRef.current) return;

		const token = getMapboxToken();
		if (!token || !isMapboxAvailable()) {
			setFailed(true);
			return;
		}

		mapboxgl.accessToken = token;

		let loaded = false;
		let map: mapboxgl.Map;

		try {
			map = new mapboxgl.Map({
				container: host,
				style: MAP_STYLES[style] ?? MAP_STYLES.dark,
				center: [centre.lng, centre.lat],
				zoom: currentZoom,
				attributionControl: false,
				interactive,
			});
		} catch {
			setFailed(true);
			return;
		}

		if (interactive) {
			map.addControl(
				new mapboxgl.NavigationControl({ showCompass: false }),
				"top-right",
			);
		}

		// Tile load guard — if tiles don't arrive within 6s, mark as failed.
		const guard = window.setTimeout(() => {
			if (!loaded) setFailed(true);
		}, TILE_TIMEOUT_MS);

		map.on("load", () => {
			loaded = true;
			window.clearTimeout(guard);
			setReady(true);

			// ---------- Pins source ----------
			map.addSource("pins", {
				type: "geojson",
				data: pinsToGeoJSON(pins),
			});

			// Circle fallback layer (behind HTML markers)
			map.addLayer({
				id: "pin-circles",
				type: "circle",
				source: "pins",
				paint: {
					"circle-radius": 8,
					"circle-color": "#d4af37",
					"circle-stroke-color": "#000",
					"circle-stroke-width": 1.5,
					"circle-opacity": 0.6,
				},
			});

			// Privacy halos
			if (showPrivacyHalos) {
				map.addLayer({
					id: "privacy-halos",
					type: "circle",
					source: "pins",
					paint: {
						"circle-radius": ["*", ["get", "radius"], 0.002],
						"circle-color": "#d4af37",
						"circle-opacity": 0.06,
						"circle-stroke-color": "#d4af37",
						"circle-stroke-opacity": 0.15,
						"circle-stroke-width": 1,
					},
				});
			}
		});

		// ---------- Click handling ----------
		map.on("click", (e) => {
			if (!onSelect && !onMapClick) return;

			const point = e.point;
			const mapInstance = mapRef.current;
			if (!mapInstance) return;

			// Find nearest pin within HIT_RADIUS_PX
			if (onSelect) {
				let closest: MapPinItem | null = null;
				let closestDist = Infinity;

				for (const pin of pins) {
					const projected = mapInstance.project([pin.lng, pin.lat]);
					const dx = projected.x - point.x;
					const dy = projected.y - point.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < HIT_RADIUS_PX && dist < closestDist) {
						closestDist = dist;
						closest = pin;
					}
				}

				if (closest) {
					onSelect(closest.id);
					return;
				}
			}

			// Empty-area click → project to lat/lng
			if (onMapClick) {
				onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
			}
		});

		// ---------- ResizeObserver ----------
		const ro = new ResizeObserver(() => map.resize());
		ro.observe(host);

		mapRef.current = map;

		return () => {
			window.clearTimeout(guard);
			ro.disconnect();
			map.remove();
			mapRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [style, interactive]);

	// ---------------------------------------------------------------------------
	// Sync pins → GeoJSON source
	// ---------------------------------------------------------------------------
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready) return;

		const source = map.getSource("pins") as mapboxgl.GeoJSONSource | undefined;
		if (source) {
			source.setData(pinsToGeoJSON(pins));
		}
	}, [pins, centre, ready]);

	// ---------------------------------------------------------------------------
	// HTML markers for pins with photos (or all pins if no circles layer suffices)
	// ---------------------------------------------------------------------------
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready) return;

		const prev = markersRef.current;

		// Remove markers that no longer exist
		for (const [id, marker] of prev) {
			if (!pins.find((p) => p.id === id)) {
				marker.remove();
				prev.delete(id);
			}
		}

		// Add or update markers
		for (const pin of pins) {
			const el = document.createElement("div");
			el.style.lineHeight = "0";

			const root = createRoot(el);
			root.render(
				<MapPinMarker
					photo={pin.photo}
					label={pin.label}
					online={pin.online}
					accent={pin.accent}
					emoji={pin.emoji}
					onClick={() => onSelect?.(pin.id)}
				/>,
			);

			const existing = prev.get(pin.id);
			if (existing) {
				existing.setLngLat([pin.lng, pin.lat]);
				// Replace element content
				existing.getElement().innerHTML = "";
				existing.getElement().appendChild(el.firstChild ?? el);
			} else {
				const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
					.setLngLat([pin.lng, pin.lat])
					.addTo(map);
				prev.set(pin.id, marker);
			}
		}

		markersRef.current = prev;
	}, [pins, ready, onSelect]);

	// ---------------------------------------------------------------------------
	// User position pulsing dot
	// ---------------------------------------------------------------------------
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !ready) return;

		if (!userPosition) {
			userMarkerRef.current?.remove();
			userMarkerRef.current = null;
			return;
		}

		if (!userMarkerRef.current) {
			const el = document.createElement("div");
			el.className = "fyk-user-dot";
			el.setAttribute("aria-label", "Your position");
			el.innerHTML = `<span class="fyk-user-pulse" />`;

			userMarkerRef.current = new mapboxgl.Marker({
				element: el,
				anchor: "center",
			})
				.setLngLat([userPosition.lng, userPosition.lat])
				.addTo(map);
		} else {
			userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat]);
		}
	}, [userPosition, ready]);

	// ---------------------------------------------------------------------------
	// Cleanup markers on unmount
	// ---------------------------------------------------------------------------
	useEffect(() => {
		return () => {
			for (const marker of markersRef.current.values()) {
				marker.remove();
			}
			markersRef.current.clear();
			userMarkerRef.current?.remove();
			userMarkerRef.current = null;
		};
	}, []);

	// ---------------------------------------------------------------------------
	// Offline / no-token fallback
	// ---------------------------------------------------------------------------
	if (failed || !isMapboxAvailable()) {
		return (
			<div
				className={cn(
					"overflow-hidden rounded-2xl border border-line bg-surface-2 p-5",
					className,
				)}
				style={{ minHeight: height }}
			>
				<p className="text-[13.5px] font-medium text-muted">
					Map unavailable — showing the list instead.
				</p>

				<ul className="mt-4 grid gap-2 sm:grid-cols-2">
					{pins.slice(0, 12).map((p) => (
						<li key={p.id}>
							<button
								type="button"
								onClick={() => onSelect?.(p.id)}
								className="press flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:border-gold/40 transition-colors"
							>
								<span className="flex h-4 w-4 shrink-0 items-center justify-center text-gold">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
										<circle cx="12" cy="10" r="3" />
									</svg>
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[13.5px] font-medium text-ink">
										{p.label ?? "Unknown"}
									</span>
									{p.emoji && (
										<span className="block text-[12px] text-muted">
											{p.emoji}
										</span>
									)}
								</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		);
	}

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl border border-line",
				className,
			)}
		>
			<div
				ref={containerRef}
				style={{ height }}
				className="w-full bg-surface-2"
			/>

			{/* Loading skeleton */}
			{!ready && (
				<div className="skeleton pointer-events-none absolute inset-0" />
			)}

			{/* Privacy banner */}
			<span className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
				Approximate positions — never exact GPS
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pinsToGeoJSON(pins: MapPinItem[]): GeoJSON.FeatureCollection {
	return {
		type: "FeatureCollection",
		features: pins.map((pin) => ({
			type: "Feature" as const,
			geometry: {
				type: "Point" as const,
				coordinates: [pin.lng, pin.lat],
			},
			properties: {
				id: pin.id,
				label: pin.label ?? "",
				radius: 320,
			},
		})),
	};
}
