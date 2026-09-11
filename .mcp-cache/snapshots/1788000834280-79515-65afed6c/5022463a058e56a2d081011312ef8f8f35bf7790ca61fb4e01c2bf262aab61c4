/**
 * Media dimension measurement utilities.
 * Extracted from open-grind and converted for React/TypeScript.
 */

export type MediaDimensions = { width: number; height: number };

/**
 * Measure an image's natural dimensions by loading it into a temporary element.
 * Returns a promise that resolves with { width, height } or rejects on load failure.
 */
export async function measureImage(url: string): Promise<MediaDimensions> {
	const img = document.createElement('img');
	img.src = url;
	try {
		await new Promise<void>((resolve, reject) => {
			if (img.complete) {
				if (img.naturalWidth > 0) resolve();
				else reject(new Error(`Failed to load image: ${url}`));
				return;
			}
			img.addEventListener('load', () => resolve(), { once: true });
			img.addEventListener(
				'error',
				({ error }) =>
					reject(
						new Error(`Failed to load image: ${url}`, {
							cause: error,
						}),
					),
				{ once: true },
			);
		});
		return { width: img.naturalWidth, height: img.naturalHeight };
	} finally {
		img.remove();
	}
}

/**
 * Measure a video's dimensions by loading its metadata.
 * Returns a promise that resolves with { width, height } or rejects on load failure.
 */
export async function measureVideo(url: string): Promise<MediaDimensions> {
	const video = document.createElement('video');
	video.src = url;
	video.load();
	try {
		await new Promise<void>((resolve, reject) => {
			if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
			video.addEventListener('loadedmetadata', () => resolve(), {
				once: true,
			});
			video.addEventListener(
				'error',
				({ error }) =>
					reject(
						new Error(`Failed to load video: ${url}`, {
							cause: error,
						}),
					),
				{ once: true },
			);
		});
		return { width: video.videoWidth, height: video.videoHeight };
	} finally {
		video.remove();
	}
}

/**
 * Measure either an image or video based on the URL extension.
 */
export async function measureMedia(url: string): Promise<MediaDimensions> {
	const isVideo = /\.(mp4|webm|mov|avi)$/i.test(url);
	return isVideo ? measureVideo(url) : measureImage(url);
}
