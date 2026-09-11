"use client";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface PhotoLightboxImage {
	src: string;
	alt: string;
}

interface PhotoLightboxProps {
	images: PhotoLightboxImage[];
	initialIndex: number;
	onClose: () => void;
}

export function PhotoLightbox({
	images,
	initialIndex,
	onClose,
}: PhotoLightboxProps) {
	const [index, setIndex] = useState(initialIndex);
	const [scale, setScale] = useState(1);
	const swipeStartX = useRef<number | null>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const total = images.length;

	const show = useCallback(
		(nextIndex: number) => {
			if (total === 0) return;
			setScale(1);
			setIndex((nextIndex + total) % total);
		},
		[total],
	);

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeButtonRef.current?.focus();

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
			if (event.key === "ArrowLeft") show(index - 1);
			if (event.key === "ArrowRight") show(index + 1);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [index, onClose, show]);

	if (total === 0 || typeof document === "undefined") return null;

	const image = images[index];

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Full-screen profile photos"
			className="fixed inset-0 z-[200] flex touch-pan-y select-none items-center justify-center bg-black/95"
			onPointerDown={(event) => {
				swipeStartX.current = event.clientX;
			}}
			onPointerUp={(event) => {
				if (swipeStartX.current === null || scale > 1) return;
				const distance = event.clientX - swipeStartX.current;
				swipeStartX.current = null;
				if (Math.abs(distance) < 48) return;
				show(distance > 0 ? index - 1 : index + 1);
			}}
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/70 to-transparent"
			/>

			<button
				ref={closeButtonRef}
				type="button"
				onClick={onClose}
				aria-label="Close full-screen photos"
				className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-20 flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				<X className="size-5" />
			</button>

			<div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold tracking-wide text-white backdrop-blur-xl">
				<Maximize2 className="size-3.5 text-gold" />
				<span aria-live="polite">
					{index + 1} / {total}
				</span>
			</div>

			<button
				type="button"
				onClick={() => setScale((current) => (current === 1 ? 2.25 : 1))}
				className="flex size-full cursor-zoom-in items-center justify-center overflow-auto p-0 sm:p-6"
				aria-label={scale === 1 ? "Zoom in" : "Reset zoom"}
			>
				<img
					src={image.src}
					alt={image.alt}
					draggable={false}
					className="max-h-full max-w-full object-contain transition-transform duration-200"
					style={{ transform: `scale(${scale})` }}
				/>
			</button>

			{total > 1 && (
				<>
					<button
						type="button"
						onClick={() => show(index - 1)}
						aria-label="Previous photo"
						className="absolute left-3 top-1/2 z-20 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl transition hover:bg-white/15 sm:flex"
					>
						<ChevronLeft className="size-6" />
					</button>
					<button
						type="button"
						onClick={() => show(index + 1)}
						aria-label="Next photo"
						className="absolute right-3 top-1/2 z-20 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl transition hover:bg-white/15 sm:flex"
					>
						<ChevronRight className="size-6" />
					</button>
					<div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/45 px-3 py-2 backdrop-blur-xl">
						{images.map((photo, photoIndex) => (
							<button
								type="button"
								key={photo.src}
								onClick={() => show(photoIndex)}
								aria-label={`View photo ${photoIndex + 1}`}
								className={`h-1.5 rounded-full transition-all ${photoIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
							/>
						))}
					</div>
				</>
			)}
		</div>,
		document.body,
	);
}
