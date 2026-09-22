import { useState, useCallback, useEffect, type ReactNode } from "react";
import { X, MapPin } from "lucide-react";
import { cn } from "../cn";
import { MapPicker } from "@/components/map/MapPicker";
import { encodeGeohash } from "@/core/model/geohash";

interface LocationChooserProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (submission: {
		geohash: string;
		autoUpdateLocation: boolean;
	}) => void;
	initialPinPos?: { lat: number; lon: number; zoom: number };
	gpsAvailable?: boolean;
	autoUpdateLocation?: boolean;
	onAutoUpdateChange?: (enabled: boolean) => void;
	className?: string;
}

export function LocationChooser({
	open,
	onClose,
	onSubmit,
	initialPinPos,
	gpsAvailable = false,
	autoUpdateLocation = false,
	onAutoUpdateChange,
	className,
}: LocationChooserProps): ReactNode {
	const [pickedPos, setPickedPos] = useState<{ lat: number; lng: number } | null>(
		initialPinPos ? { lat: initialPinPos.lat, lng: initialPinPos.lon } : null,
	);
	const [label, setLabel] = useState<string | undefined>();

	const handlePick = useCallback((latlng: { lat: number; lng: number }, pickedLabel?: string) => {
		setPickedPos(latlng);
		setLabel(pickedLabel);
	}, []);

	const handleSubmit = useCallback(() => {
		if (!pickedPos) return;
		const geohash = encodeGeohash({ lat: pickedPos.lat, lon: pickedPos.lng });
		onSubmit({ geohash, autoUpdateLocation });
		onClose();
	}, [pickedPos, autoUpdateLocation, onSubmit, onClose]);

	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className={cn(
				"fixed inset-0 z-50 flex items-end justify-center sm:items-center",
				className,
			)}
		>
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Dialog */}
			<div className="relative z-10 flex w-full max-w-2xl flex-col rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-line px-4 py-3">
					<div>
						<h2 className="text-lg font-semibold text-white">Choose location</h2>
						<p className="text-sm text-white/60">
							Tap the map to place a pin, or search for an address.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex size-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
						aria-label="Close"
					>
						<X className="size-4" />
					</button>
				</div>

				{/* Map Picker */}
				<div className="h-80">
					<MapPicker
						initialPosition={pickedPos ?? undefined}
						onPick={handlePick}
						onCancel={onClose}
						height={320}
					/>
				</div>

				{/* Selected address display */}
				{label && (
					<div className="flex items-center gap-2 border-t border-line px-4 py-2">
						<MapPin className="size-4 shrink-0 text-gold" />
						<span className="truncate text-sm text-white/80">{label}</span>
					</div>
				)}

				{/* Footer */}
				<div className="flex items-center justify-between border-t border-line px-4 py-3">
					{gpsAvailable && (
						<label className="flex items-center gap-2 text-sm text-white/60">
							<input
								type="checkbox"
								checked={autoUpdateLocation}
								onChange={(e) => onAutoUpdateChange?.(e.target.checked)}
								className="size-4 rounded accent-gold"
							/>
							<span className="truncate py-1">
								Update automatically using GPS
							</span>
						</label>
					)}
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!pickedPos}
						className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold/90 disabled:opacity-50"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}
