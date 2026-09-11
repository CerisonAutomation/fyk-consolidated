/**
 * Unit conversion utilities for metric/imperial systems.
 * Extracted from open-grind and converted for React/TypeScript.
 */

export type UnitSystem = "metric" | "imperial";

const FEET_PER_METRE = 3.28084;
const METRES_PER_MILE = 1609.344;
const INCHES_PER_CM = 0.3937007874;
const POUNDS_PER_KG = 2.2046226218;

/**
 * Format a distance in metres to a human-readable string.
 * Metric: "150 m" or "1.2 km"
 * Imperial: "492 ft" or "1.0 mi"
 */
export function formatDistance(
	distanceMetres: number,
	units: UnitSystem,
): string {
	if (units === "imperial") {
		if (distanceMetres < METRES_PER_MILE) {
			return `${Math.round(distanceMetres * FEET_PER_METRE)} ft`;
		}
		return `${(distanceMetres / METRES_PER_MILE).toFixed(1)} mi`;
	}

	if (distanceMetres < 1000) {
		return `${Math.round(distanceMetres)} m`;
	}
	return `${(distanceMetres / 1000).toFixed(1)} km`;
}

/**
 * Format a height in cm to a human-readable string.
 * Metric: "180 cm"
 * Imperial: "5'11\""
 */
export function formatHeight(heightCm: number, units: UnitSystem): string {
	if (units === "imperial") {
		const totalInches = Math.round(heightCm * INCHES_PER_CM);
		const feet = Math.floor(totalInches / 12);
		const inches = totalInches % 12;
		return `${feet}'${inches}"`;
	}

	return `${Math.round(heightCm)} cm`;
}

/**
 * Format a weight in kg to a human-readable string.
 * Metric: "80 kg"
 * Imperial: "176 lb"
 */
export function formatWeightKg(weightKg: number, units: UnitSystem): string {
	if (units === "imperial") {
		return `${Math.round(weightKg * POUNDS_PER_KG)} lb`;
	}

	return `${Math.round(weightKg)} kg`;
}

/**
 * Format a weight in grams to a human-readable string.
 */
export function formatWeightGrams(
	weightGrams: number,
	units: UnitSystem,
): string {
	return formatWeightKg(weightGrams / 1000, units);
}
