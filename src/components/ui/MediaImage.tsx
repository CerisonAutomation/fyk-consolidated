import { ImageOff } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "#/lib/utils";

/**
 * Every image in FYK goes through this component.
 *
 * Photos are the most fragile part of a social app: signed URLs expire, uploads
 * fail midway, CDN nodes drop objects. A broken `<img>` inside a profile card
 * reads as "this app is unfinished" far faster than any copy does, so the
 * fallback is a first-class state with its own label, not an empty box.
 */
export function MediaImage({
	src,
	alt = "",
	className,
	ratio = "3 / 4",
	priority = false,
	label,
}: {
	src: string | null | undefined;
	alt?: string;
	className?: string;
	ratio?: string;
	priority?: boolean;
	label?: string;
}) {
	const [failed, setFailed] = useState(false);
	const [loaded, setLoaded] = useState(false);

	const onError = useCallback(() => setFailed(true), []);
	const onLoad = useCallback(() => setLoaded(true), []);

	// A src change (next photo in a carousel, a re-signed URL) must clear the
	// failure state or the fallback sticks forever.
	const [tracked, setTracked] = useState(src ?? null);
	if (tracked !== (src ?? null)) {
		setTracked(src ?? null);
		setFailed(false);
		setLoaded(false);
	}

	if (!src || failed) {
		return (
			<div
				{...(label === undefined ? {} : { role: "img", "aria-label": label })}
				data-slot="media-fallback"
				className={cn(
					"flex items-center justify-center border border-line bg-surface-2 text-faint",
					className,
				)}
				style={{ aspectRatio: ratio }}
			>
				<span className="flex flex-col items-center gap-1.5 px-2 text-center">
					<ImageOff className="h-5 w-5" aria-hidden="true" />
					{label ? (
						<span className="text-[10.5px] font-medium leading-tight">
							{label}
						</span>
					) : null}
				</span>
			</div>
		);
	}

	return (
		<img
			src={src}
			alt={alt}
			loading={priority ? "eager" : "lazy"}
			decoding="async"
			draggable={false}
			onError={onError}
			onLoad={onLoad}
			className={cn(
				"bg-surface-2 object-cover transition-opacity duration-200",
				loaded ? "opacity-100" : "opacity-0",
				className,
			)}
			style={{ aspectRatio: ratio }}
		/>
	);
}
