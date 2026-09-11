import type { ReactNode } from "react";

interface DistanceFormattedProps {
	distance: number;
	/** Unit system for display. Falls back to "metric" if not provided. */
	units?: "metric" | "imperial";
}

function formatDistance(
	distance: number,
	units: "metric" | "imperial",
): string {
	if (units === "imperial") {
		const miles = distance * 0.000621371;
		return miles < 0.1 ? "Less than 0.1 mi" : `${miles.toFixed(1)} mi`;
	}
	const km = distance / 1000;
	return km < 0.1 ? "Less than 0.1 km" : `${km.toFixed(1)} km`;
}

export function DistanceFormatted({
	distance,
	units = "metric",
}: DistanceFormattedProps): ReactNode {
	return <>{formatDistance(distance, units)}</>;
}
