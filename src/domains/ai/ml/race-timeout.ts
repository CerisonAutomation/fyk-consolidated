/**
 * `Promise.race` with a timeout that clears its timer when the main promise
 * settles — prevents orphaned `setTimeout` callbacks from holding closure
 * references for the full timeout duration after the race is won.
 *
 * @param task   - The promise to race.
 * @param ms     - Timeout in milliseconds.
 * @param onTimeout - Returns the fallback value (or throws) when time runs out.
 */
export function raceTimeout<T, F>(
	task: Promise<T>,
	ms: number,
	onTimeout: () => F,
): Promise<T | F> {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const sentinel = new Promise<F>((resolve, reject) => {
		timer = setTimeout(() => {
			try {
				resolve(onTimeout());
			} catch (err) {
				reject(err);
			}
		}, ms);
	});

	return Promise.race([task, sentinel]).finally(() => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	});
}
