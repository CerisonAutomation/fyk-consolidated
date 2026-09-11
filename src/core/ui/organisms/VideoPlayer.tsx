import {
	useState,
	useRef,
	useCallback,
	useEffect,
	type ReactNode,
} from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "../cn";
import { VideoScrubber } from "../molecules/VideoScrubber";

interface VideoPlayerProps {
	src: string;
	poster?: string | null;
	onReady?: () => void;
	onFail?: () => void;
	autoplay?: boolean;
	className?: string;
}

function formatMediaDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface MediaTimeRange {
	start: number;
	end: number;
}

export function VideoPlayer({
	src,
	poster,
	onReady,
	onFail,
	autoplay = false,
	className,
}: VideoPlayerProps): ReactNode {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [paused, setPaused] = useState(true);
	const [muted, setMuted] = useState(true);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [buffered, setBuffered] = useState<MediaTimeRange[]>([]);
	const [hovering, setHovering] = useState(false);
	const [focusHeld, setFocusHeld] = useState(false);
	const [revealed, setRevealed] = useState(true);

	const controlsVisible = revealed || hovering || focusHeld;

	// Sync video element state
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const onTimeUpdate = () => setCurrentTime(video.currentTime);
		const onDurationChange = () => setDuration(video.duration);
		const onPlay = () => setPaused(false);
		const onPause = () => setPaused(true);
		const onLoadedData = () => onReady?.();
		const onError = () => onFail?.();

		const updateBuffered = () => {
			const ranges: MediaTimeRange[] = [];
			for (let i = 0; i < video.buffered.length; i++) {
				ranges.push({
					start: video.buffered.start(i),
					end: video.buffered.end(i),
				});
			}
			setBuffered(ranges);
		};

		video.addEventListener("timeupdate", onTimeUpdate);
		video.addEventListener("durationchange", onDurationChange);
		video.addEventListener("play", onPlay);
		video.addEventListener("pause", onPause);
		video.addEventListener("loadeddata", onLoadedData);
		video.addEventListener("error", onError);
		video.addEventListener("progress", updateBuffered);

		return () => {
			video.removeEventListener("timeupdate", onTimeUpdate);
			video.removeEventListener("durationchange", onDurationChange);
			video.removeEventListener("play", onPlay);
			video.removeEventListener("pause", onPause);
			video.removeEventListener("loadeddata", onLoadedData);
			video.removeEventListener("error", onError);
			video.removeEventListener("progress", updateBuffered);
		};
	}, [onReady, onFail]);

	const togglePlayPause = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			video.play().catch(() => {});
		} else {
			video.pause();
		}
	}, []);

	const toggleMute = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		video.muted = !video.muted;
		setMuted(video.muted);
	}, []);

	const handleSeek = useCallback((time: number) => {
		const video = videoRef.current;
		if (!video) return;
		video.currentTime = time;
		setCurrentTime(time);
	}, []);

	const handlePointerEnter = useCallback((e: React.PointerEvent) => {
		if (e.pointerType === "mouse") setHovering(true);
	}, []);

	const handlePointerLeave = useCallback((e: React.PointerEvent) => {
		if (e.pointerType !== "mouse") return;
		setHovering(false);
		setRevealed(false);
	}, []);

	const handleToggle = useCallback((e: React.PointerEvent) => {
		if (e.pointerType !== "mouse") setRevealed((r) => !r);
	}, []);

	const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
		setFocusHeld(
			e.target instanceof Element && e.target.matches(":focus-visible"),
		);
	}, []);

	const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
		setFocusHeld(
			e.relatedTarget instanceof Node &&
				e.currentTarget.contains(e.relatedTarget),
		);
	}, []);

	return (
		<div
			data-slot="video-surface"
			className={cn("relative size-full", className)}
			onPointerEnter={handlePointerEnter}
			onPointerLeave={handlePointerLeave}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<video
				ref={videoRef}
				onPointerDown={handleToggle}
				src={src}
				poster={poster ?? undefined}
				playsInline
				preload="metadata"
				muted={muted}
				className="size-full object-contain"
				autoPlay={autoplay}
			/>

			{controlsVisible && (
				<div
					data-pswp-interactive
					className={cn(
						"absolute right-[calc(1rem+var(--safe-area-right,0px))] bottom-[calc(1rem+var(--safe-area-bottom,0px))] left-[calc(1rem+var(--safe-area-left,0px))] flex items-center gap-3 rounded-full p-3 text-white",
						"bg-black/40 backdrop-blur-xl",
						"animate-in fade-in duration-150",
					)}
				>
					<button
						type="button"
						aria-label={paused ? "Play" : "Pause"}
						className="shrink-0 cursor-pointer inline-flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur hover:bg-white/20"
						onClick={togglePlayPause}
					>
						{paused ? (
							<Play className="size-[22px]" fill="currentColor" />
						) : (
							<Pause className="size-[22px]" fill="currentColor" />
						)}
					</button>

					<span className="shrink-0 text-[13px] tracking-tight tabular-nums">
						{formatMediaDuration(currentTime)}
					</span>

					<VideoScrubber
						currentTime={currentTime}
						duration={duration}
						buffered={buffered}
						onSeek={handleSeek}
					/>

					<span className="shrink-0 text-[13px] tracking-tight tabular-nums">
						{formatMediaDuration(duration)}
					</span>

					<button
						type="button"
						aria-label={muted ? "Unmute" : "Mute"}
						className="shrink-0 cursor-pointer inline-flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur hover:bg-white/20"
						onClick={toggleMute}
					>
						{muted ? (
							<VolumeX className="size-[22px]" fill="currentColor" />
						) : (
							<Volume2 className="size-[22px]" fill="currentColor" />
						)}
					</button>
				</div>
			)}
		</div>
	);
}
