import { getPreferencesSnapshot, setPreferences } from '#/domains/settings/preferences';
import { decodeGeohash, encodeGeohash } from '#/core/model/geohash';
import { now } from '#/core/lib/clock';
import { distanceMeters, type Coordinates } from './distance';

export const BACKGROUND_FIX_MAX_AGE_MS = 6 * 60 * 1000;
export const INTERACTIVE_FIX_MAX_AGE_MS = 10_000;
export const GPS_FIX_TIMEOUT_MS = 15_000;
const MIN_MOVE_METERS = 100;

interface LocationOutcome {
	status: 'ok' | 'denied' | 'error';
	coords?: Coordinates;
	error?: Error;
}

class AutoLocation {
	#suspended = false;
	#promptAllowed = true;
	#failureReported = false;
	#lastFixAt: number | null = null;
	#lastCoords: Coordinates | null = null;

	suspend(): void {
		this.#suspended = true;
	}

	resume(): void {
		this.#suspended = false;
	}

	async resolveGeohash(
		current: string,
		{ background = false } = {},
	): Promise<string> {
		const maxAgeMs = background
			? BACKGROUND_FIX_MAX_AGE_MS
			: INTERACTIVE_FIX_MAX_AGE_MS;
		if (!this.#canSample() || !this.#fixStale(maxAgeMs)) return current;
		const prompt = this.#promptAllowed && !this.#suspended;
		const outcome = await this.#timeboxedFix(prompt);
		if (prompt) this.#promptAllowed = false;
		if (outcome === 'timeout') return current;
		if (this.#suspended) return current;
		if (outcome.status === 'ok' && outcome.coords) {
			this.#failureReported = false;
			this.#lastFixAt = now();
			this.#lastCoords = outcome.coords;
			const moved =
				distanceMeters({
					from: decodeGeohash(current),
					to: outcome.coords,
				}) >= MIN_MOVE_METERS;
			return moved ? encodeGeohash(outcome.coords) : current;
		}
		if (outcome.status === 'denied') {
			setPreferences({ autoUpdateLocation: false }).catch(
				(error: unknown) => console.error(error),
			);
			return current;
		}
		if (outcome.status === 'error') {
			console.error(outcome.error);
			this.#reportOnce(() => {
				console.error('Failed to update your location automatically', outcome.error);
			});
		}
		return current;
	}

	#canSample(): boolean {
		if (!getPreferencesSnapshot().autoUpdateLocation) return false;
		return !(typeof document !== 'undefined' && document.hidden);
	}

	#fixStale(maxAgeMs: number): boolean {
		return this.#lastFixAt === null || now() - this.#lastFixAt >= maxAgeMs;
	}

	async #timeboxedFix(prompt: boolean): Promise<LocationOutcome | 'timeout'> {
		const request = this.#requestLocation(prompt);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const outcome = await Promise.race([
			request,
			new Promise<'timeout'>((resolve) => {
				timer = setTimeout(
					() => resolve('timeout'),
					GPS_FIX_TIMEOUT_MS,
				);
			}),
		]);
		clearTimeout(timer);
		return outcome;
	}

	#requestLocation(prompt: boolean): Promise<LocationOutcome> {
		return new Promise((resolve) => {
			if (typeof navigator === 'undefined' || !navigator.geolocation) {
				resolve({ status: 'error', error: new Error('Geolocation not available') });
				return;
			}
			const onSuccess = (position: GeolocationPosition) => {
				resolve({
					status: 'ok',
					coords: {
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					},
				});
			};
			const onError = (error: GeolocationPositionError) => {
				if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
					resolve({ status: 'denied' });
				} else {
					resolve({ status: 'error', error: new Error(error.message) });
				}
			};
			if (prompt) {
				navigator.geolocation.getCurrentPosition(onSuccess, onError, {
					enableHighAccuracy: true,
					timeout: GPS_FIX_TIMEOUT_MS,
				});
			} else {
				navigator.geolocation.getCurrentPosition(onSuccess, onError, {
					enableHighAccuracy: false,
					timeout: GPS_FIX_TIMEOUT_MS,
				});
			}
		});
	}

	#reportOnce(report: () => void): void {
		if (this.#failureReported) return;
		this.#failureReported = true;
		report();
	}
}

export const autoLocation = new AutoLocation();
