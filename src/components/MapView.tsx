import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapPin, WifiOff } from "lucide-react";
import { CITY_CENTROIDS, type LatLng } from "@/lib/geo";
import { cn } from "@/utils/cn";

export type MapPinItem = {
	id: string;
	lat: number;
	lng: number;
	label: string;
	sub?: string;
	photo?: string;
	online?: boolean;
	accent?: boolean;
};

/**
 * Leaflet + OpenStreetMap. No API key, no tracking pixels.
 * Every marker is an approximate, deterministically fuzzed position — never a live GPS fix.
 * If tiles can't load (offline / blocked) we fall back to a readable list.
 */
export function MapView({
	city = "valletta",
	pins,
	height = 420,
	onSelect,
	className,
	interactive = true,
}: {
	city?: string;
	pins: MapPinItem[];
	height?: number;
	onSelect?: (id: string) => void;
	className?: string;
	interactive?: boolean;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<L.Map | null>(null);
	const layerRef = useRef<L.LayerGroup | null>(null);
	const [failed, setFailed] = useState(false);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const host = hostRef.current;
		if (!host || mapRef.current) return;

		const centre = CITY_CENTROIDS[city] ?? CITY_CENTROIDS.valletta!;
		let map: L.Map;
		try {
			map = L.map(host, {
				center: [centre.lat, centre.lng],
				zoom: centre.zoom,
				zoomControl: interactive,
				scrollWheelZoom: false,
				dragging: interactive,
				attributionControl: true,
			});
		} catch {
			setFailed(true);
			return;
		}

		const tiles = L.tileLayer(
			"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
			{
				maxZoom: 18,
				attribution:
					'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			},
		);

		let loaded = false;
		tiles.on("load", () => {
			loaded = true;
			setReady(true);
		});
		tiles.on("tileerror", () => {
			if (!loaded) setFailed(true);
		});
		tiles.addTo(map);
		layerRef.current = L.layerGroup().addTo(map);
		mapRef.current = map;

		const guard = window.setTimeout(() => {
			if (!loaded) setFailed(true);
		}, 6000);

		const ro = new ResizeObserver(() => map.invalidateSize());
		ro.observe(host);

		return () => {
			window.clearTimeout(guard);
			ro.disconnect();
			map.remove();
			mapRef.current = null;
			layerRef.current = null;
		};
	}, [city, interactive]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		const centre = CITY_CENTROIDS[city] ?? CITY_CENTROIDS.valletta!;
		map.setView([centre.lat, centre.lng], centre.zoom, { animate: true });
	}, [city]);

	useEffect(() => {
		const layer = layerRef.current;
		if (!layer) return;
		layer.clearLayers();

		for (const p of pins) {
			const html = `
        <div class="fyk-pin ${p.accent ? "is-accent" : ""}">
          ${p.photo ? `<img src="${p.photo}" alt="" width="44" height="44" loading="lazy" decoding="async" />` : `<span class="fyk-pin-dot"></span>`}
          ${p.online ? '<i class="fyk-pin-online"></i>' : ""}
        </div>`;
			const icon = L.divIcon({
				html,
				className: "fyk-pin-wrap",
				iconSize: [44, 44],
				iconAnchor: [22, 22],
			});
			const marker = L.marker([p.lat, p.lng], {
				icon,
				title: p.label,
				keyboard: true,
			}).addTo(layer);
			marker.bindTooltip(`${p.label}${p.sub ? ` · ${p.sub}` : ""}`, {
				direction: "top",
				offset: [0, -18],
			});
			if (onSelect) marker.on("click", () => onSelect(p.id));
			// Approximate-area halo so nobody reads a pin as an address.
			L.circle([p.lat, p.lng], {
				radius: 320,
				color: "var(--c-gold)",
				weight: 1,
				opacity: 0.35,
				fillColor: "var(--c-gold)",
				fillOpacity: 0.07,
			}).addTo(layer);
		}
	}, [pins, onSelect, ready]);

	if (failed) {
		return (
			<div
				className={cn(
					"overflow-hidden rounded-2xl border border-line bg-surface-2 p-5",
					className,
				)}
				style={{ minHeight: height }}
			>
				<div className="flex items-center gap-2.5 text-muted">
					<WifiOff className="h-[18px] w-[18px]" />
					<p className="text-[13.5px] font-medium">
						Map tiles unavailable — showing the list instead.
					</p>
				</div>
				<ul className="mt-4 grid gap-2 sm:grid-cols-2">
					{pins.slice(0, 12).map((p) => (
						<li key={p.id}>
							<button
								type="button"
								onClick={() => onSelect?.(p.id)}
								className="press flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:border-gold/40"
							>
								<MapPin className="h-4 w-4 shrink-0 text-gold" />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[13.5px] font-medium text-ink">
										{p.label}
									</span>
									{p.sub && (
										<span className="block truncate text-[12px] text-muted">
											{p.sub}
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

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl border border-line",
				className,
			)}
		>
			<div ref={hostRef} style={{ height }} className="w-full bg-surface-2" />
			{!ready && (
				<div className="skeleton pointer-events-none absolute inset-0" />
			)}
			<span className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
				Approximate positions · never exact GPS
			</span>
		</div>
	);
}

export function pinFrom(
	coords: LatLng,
	extra: Omit<MapPinItem, "lat" | "lng">,
): MapPinItem {
	return { ...extra, lat: coords.lat, lng: coords.lng };
}
