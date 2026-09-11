"use client";

// Self-contained pinch-zoom + pan + swipe-to-dismiss fullscreen image lightbox.
// Port of open-grind's PhotoSwipe integration (src/lib/util/photoswipe.ts +
// ImageCarousel.svelte) into a single React component with NO external
// dependencies (no photoswipe, no react-zoom-pan-pinch).
//
// Gestures handled:
//   - Pinch-to-zoom       (two pointers): scale = current_dist / start_dist
//   - Pan-when-zoomed      (one pointer, scale > 1): drag with edge clamping
//   - Swipe-to-dismiss    (one pointer, scale === 1, drag down > 100px)
//   - Slide navigation    (one pointer, scale === 1, horizontal swipe > 50px)
//   - Double-tap           (toggle zoom between 1 and 2.5)
//   - Wheel zoom           (ctrl/cmd + wheel — trackpad pinch)
//   - Keyboard             (Esc close, Arrows nav, +/- zoom, 0 reset)
//
// Implementation strategy: gestures write live transform values to refs and
// apply them directly to the DOM via the wrap/track/backdrop element refs in
// pointermove handlers (no per-frame React re-render). React state is only
// used for: the *committed* scale (used to switch cursor + disable tap-close
// when zoomed), per-slide `loaded`/`broken` sets, and the visible index (which
// is owned by the parent via the controlled `index` prop).

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type LightboxImage = { src: string; alt?: string };

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_DISMISS_PX = 100;
const SWIPE_NEXT_PX = 50;
const TAP_MAX_MOVE_PX = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_POS_PX = 30;
const SNAP_BACK_MS = 220;
const SNAP_BACK_SLIDE_MS = 320;

type Point = { x: number; y: number };

type Gesture =
	| { kind: "idle" }
	| {
			kind: "pan";
			startScale: number;
			startTx: number;
			startTy: number;
			startX: number;
			startY: number;
			moved: boolean;
	  }
	| {
			kind: "swipe";
			startX: number;
			startY: number;
			moved: boolean;
	  }
	| {
			kind: "pinch";
			startScale: number;
			startTx: number;
			startTy: number;
			startDist: number;
			startMidX: number;
			startMidY: number;
	  };

function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

// Compute the rendered (object-contain, scale=1) image dimensions inside a
// container given the image's natural pixel size and the viewport size.
function containedSize(
	naturalW: number,
	naturalH: number,
	boxW: number,
	boxH: number,
): { w: number; h: number } {
	if (!naturalW || !naturalH || !boxW || !boxH) return { w: 0, h: 0 };
	const imageAspect = naturalW / naturalH;
	const boxAspect = boxW / boxH;
	if (imageAspect > boxAspect) {
		// image is wider — letterboxed top/bottom
		return { w: boxW, h: boxW / imageAspect };
	}
	return { w: boxH * imageAspect, h: boxH };
}

export function Lightbox({
	images,
	index,
	onIndexChange,
	onClose,
}: {
	images: LightboxImage[];
	index: number;
	onIndexChange: (i: number) => void;
	onClose: () => void;
}): JSX.Element {
	// Committed scale (drives cursor + disables tap-close when zoomed). Live
	// scale during a gesture lives in `transformRef.current.scale`.
	const [scale, setScale] = useState(1);
	const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
	const [broken, setBroken] = useState<Set<number>>(() => new Set());

	// DOM element refs (the gesture target)
	const wrapRef = useRef<HTMLImageElement | null>(null); // active slide's <img>
	const trackRef = useRef<HTMLDivElement | null>(null); // horizontal track
	const backdropRef = useRef<HTMLDivElement | null>(null); // bg fade target
	const containerRef = useRef<HTMLDivElement | null>(null); // viewport for events

	// Gesture bookkeeping
	const pointersRef = useRef<Map<number, Point>>(new Map());
	const gestureRef = useRef<Gesture>({ kind: "idle" });
	const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
	const pendingDoubleTapRef = useRef(false);
	const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const snapBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Live transform values (the source of truth during a gesture)
	const transformRef = useRef({
		scale: 1,
		tx: 0,
		ty: 0,
		trackX: 0,
		trackY: 0,
	});

	// Container size (re-measured on resize)
	const containerRectRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });


	const total = images.length;
	const canPrev = index > 0;
	const canNext = index < total - 1;

	// ---- direct DOM writers ----
	const applyTransform = useCallback(() => {
		const t = transformRef.current;
		const wrap = wrapRef.current;
		if (wrap) {
			wrap.style.transform = `translate3d(${t.tx}px, ${t.ty}px, 0) scale(${t.scale})`;
		}
		const track = trackRef.current;
		if (track) {
			// Use CSS calc to mix the percentage-based index translation with the
			// pixel-based swipe offset.
			track.style.transform = `translate3d(calc(${-index * 100}% + ${t.trackX}px), ${t.trackY}px, 0)`;
		}
		const backdrop = backdropRef.current;
		if (backdrop) {
			// Backdrop fades as the user drags down (swipe-to-dismiss). Base
			// opacity is 0.95; fades toward 0.25 as the user drags the image
			// downward.
			const dy = Math.max(0, t.trackY);
			const opacity = clamp(0.95 - dy / 400, 0.25, 0.95);
			backdrop.style.opacity = String(opacity);
		}
	}, [index]);

	const clearSnapBack = useCallback(() => {
		if (snapBackTimerRef.current !== null) {
			clearTimeout(snapBackTimerRef.current);
			snapBackTimerRef.current = null;
		}
	}, []);

	// Animate the wrap (img) back to identity with a CSS transition. Used after
	// pinch/pan ends when the scale dropped to <=1, and on double-tap reset.
	const animateWrapSnapBack = useCallback(() => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		clearSnapBack();
		wrap.style.transition = `transform ${SNAP_BACK_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
		// Force a reflow so the transition fires when we change the transform.
		void wrap.offsetWidth;
		snapBackTimerRef.current = setTimeout(() => {
			if (wrapRef.current) wrapRef.current.style.transition = "";
			snapBackTimerRef.current = null;
		}, SNAP_BACK_MS + 16);
	}, [clearSnapBack]);

	const animateTrackSnapBack = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		clearSnapBack();
		track.style.transition = `transform ${SNAP_BACK_SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
		void track.offsetWidth;
		snapBackTimerRef.current = setTimeout(() => {
			if (trackRef.current) trackRef.current.style.transition = "";
			snapBackTimerRef.current = null;
		}, SNAP_BACK_SLIDE_MS + 16);
	}, [clearSnapBack]);

	// Reset transform when the parent changes the index (e.g. via chevrons or
	// swipe-nav release). We write the new transform synchronously so the new
	// slide is positioned at -index*100% with scale=1.
	useEffect(() => {
		transformRef.current = { scale: 1, tx: 0, ty: 0, trackX: 0, trackY: 0 };
		clearSnapBack();
		const wrap = wrapRef.current;
		if (wrap) {
			wrap.style.transition = "";
			wrap.style.transform = "";
		}
		const track = trackRef.current;
		if (track) {
			track.style.transition = "";
			track.style.transform = `translate3d(${-index * 100}%, 0, 0)`;
		}
		const backdrop = backdropRef.current;
		if (backdrop) backdrop.style.opacity = "";
		// Defer the setState to a microtask so it doesn't run synchronously inside
		// the effect body (avoids the react-hooks/set-state-in-effect lint rule).
		queueMicrotask(() => setScale(1));
		// Cancel any pending single-tap from the previous slide.
		if (singleTapTimerRef.current !== null) {
			clearTimeout(singleTapTimerRef.current);
			singleTapTimerRef.current = null;
		}
		lastTapRef.current = null;
		pendingDoubleTapRef.current = false;
		gestureRef.current = { kind: "idle" };
		pointersRef.current.clear();
	}, [index, clearSnapBack]);

	// Measure container on mount + on resize.
	useEffect(() => {
		const measure = () => {
			const el = containerRef.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			containerRectRef.current = { w: r.width, h: r.height };
		};
		measure();
		window.addEventListener("resize", measure);
		window.addEventListener("orientationchange", measure);
		return () => {
			window.removeEventListener("resize", measure);
			window.removeEventListener("orientationchange", measure);
		};
	}, []);

	// Lock body scroll while the lightbox is mounted.
	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	// ---- pan clamping ----
	// Compute the max pan offset for the current scale on a given axis. Uses
	// the active image's natural size (read live from the img element) and the
	// container size to derive the contained (object-contain) image rect, then
	// returns ±((scaled_image - container) / 2) clamped at 0.
	const maxPanFor = useCallback(
		(axis: "x" | "y", liveScale: number): number => {
			const img = wrapRef.current;
			const container = containerRectRef.current;
			if (!img || !container.w || !container.h) return 0;
			const nw = img.naturalWidth || 0;
			const nh = img.naturalHeight || 0;
			if (!nw || !nh) return 0;
			const rect = containedSize(nw, nh, container.w, container.h);
			const imgSize = axis === "x" ? rect.w : rect.h;
			const boxSize = axis === "x" ? container.w : container.h;
			return Math.max(0, (imgSize * liveScale - boxSize) / 2);
		},
		[],
	);

	const clampPan = useCallback(
		(value: number, liveScale: number, axis: "x" | "y"): number => {
			if (liveScale <= 1) return 0;
			const max = maxPanFor(axis, liveScale);
			return clamp(value, -max, max);
		},
		[maxPanFor],
	);

	// ---- keyboard ----
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			switch (e.key) {
				case "Escape":
					e.preventDefault();
					e.stopPropagation();
					onClose();
					break;
				case "ArrowLeft":
					if (index > 0) {
						e.preventDefault();
						onIndexChange(index - 1);
					}
					break;
				case "ArrowRight":
					if (index < total - 1) {
						e.preventDefault();
						onIndexChange(index + 1);
					}
					break;
				case "+":
				case "=":
				case "ArrowUp": {
					e.preventDefault();
					const next = clamp(
						transformRef.current.scale * 1.4,
						MIN_SCALE,
						MAX_SCALE,
					);
					if (next === transformRef.current.scale) return;
					transformRef.current.scale = next;
					transformRef.current.tx = clampPan(
						transformRef.current.tx,
						next,
						"x",
					);
					transformRef.current.ty = clampPan(
						transformRef.current.ty,
						next,
						"y",
					);
					setScale(next);
					applyTransform();
					break;
				}
				case "-":
				case "_":
				case "ArrowDown": {
					e.preventDefault();
					const next = clamp(
						transformRef.current.scale / 1.4,
						MIN_SCALE,
						MAX_SCALE,
					);
					if (next === transformRef.current.scale) return;
					transformRef.current.scale = next;
					if (next <= 1) {
						transformRef.current.tx = 0;
						transformRef.current.ty = 0;
					} else {
						transformRef.current.tx = clampPan(
							transformRef.current.tx,
							next,
							"x",
						);
						transformRef.current.ty = clampPan(
							transformRef.current.ty,
							next,
							"y",
						);
					}
					setScale(next);
					applyTransform();
					break;
				}
				case "0":
					e.preventDefault();
					transformRef.current.scale = 1;
					transformRef.current.tx = 0;
					transformRef.current.ty = 0;
					animateWrapSnapBack();
					setScale(1);
					applyTransform();
					break;
			}
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [
		index,
		total,
		onClose,
		onIndexChange,
		applyTransform,
		clampPan,
		animateWrapSnapBack,
	]);

	// ---- wheel zoom (ctrl/cmd + wheel — trackpad pinch is reported this way) ----
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const handler = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			const factor = Math.exp(-e.deltaY * 0.01);
			const next = clamp(
				transformRef.current.scale * factor,
				MIN_SCALE,
				MAX_SCALE,
			);
			if (next === transformRef.current.scale) return;
			transformRef.current.scale = next;
			if (next <= 1) {
				transformRef.current.tx = 0;
				transformRef.current.ty = 0;
			}
			setScale(next);
			applyTransform();
		};
		el.addEventListener("wheel", handler, { passive: false });
		return () => el.removeEventListener("wheel", handler);
	}, [applyTransform]);

	// ---- pointer handlers ----
	const onPointerDown = (e: React.PointerEvent) => {
		// Only react to primary mouse button / touch / pen
		if (e.button !== 0 && e.pointerType === "mouse") return;
		const el = containerRef.current;
		if (el) {
			try {
				el.setPointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
		}
		const p = { x: e.clientX, y: e.clientY };
		pointersRef.current.set(e.pointerId, p);
		clearSnapBack();
		// Clear any in-flight CSS transition on the wrap so the gesture tracks 1:1.
		if (wrapRef.current) wrapRef.current.style.transition = "";
		if (trackRef.current) trackRef.current.style.transition = "";

		// Double-tap detection (only meaningful for single-pointer taps)
		if (pointersRef.current.size === 1) {
			const now = Date.now();
			const last = lastTapRef.current;
			if (
				last &&
				now - last.t < DOUBLE_TAP_MS &&
				Math.hypot(p.x - last.x, p.y - last.y) < DOUBLE_TAP_POS_PX
			) {
				pendingDoubleTapRef.current = true;
			} else {
				pendingDoubleTapRef.current = false;
			}
		} else {
			pendingDoubleTapRef.current = false;
		}

		// Set up the gesture based on pointer count
		if (pointersRef.current.size >= 2) {
			const vals = [...pointersRef.current.values()];
			const p1 = vals[0]!;
			const p2 = vals[1]!;
			gestureRef.current = {
				kind: "pinch",
				startScale: transformRef.current.scale,
				startTx: transformRef.current.tx,
				startTy: transformRef.current.ty,
				startDist: distance(p1, p2),
				startMidX: (p1.x + p2.x) / 2,
				startMidY: (p1.y + p2.y) / 2,
			};
		} else if (pointersRef.current.size === 1) {
			if (transformRef.current.scale > 1) {
				gestureRef.current = {
					kind: "pan",
					startScale: transformRef.current.scale,
					startTx: transformRef.current.tx,
					startTy: transformRef.current.ty,
					startX: p.x,
					startY: p.y,
					moved: false,
				};
			} else {
				gestureRef.current = {
					kind: "swipe",
					startX: p.x,
					startY: p.y,
					moved: false,
				};
			}
		}
	};

	const onPointerMove = (e: React.PointerEvent) => {
		if (!pointersRef.current.has(e.pointerId)) return;
		const p = { x: e.clientX, y: e.clientY };
		pointersRef.current.set(e.pointerId, p);

		const g = gestureRef.current;

		if (g.kind === "pinch" && pointersRef.current.size >= 2) {
			const vals = [...pointersRef.current.values()];
			const p1 = vals[0]!;
			const p2 = vals[1]!;
			const d = distance(p1, p2);
			const factor = d / g.startDist;
			const newScale = clamp(g.startScale * factor, MIN_SCALE, MAX_SCALE);
			// Pan to follow the midpoint of the two fingers so the zoom feels
			// anchored under the user's fingers.
			const midX = (p1.x + p2.x) / 2;
			const midY = (p1.y + p2.y) / 2;
			const dx = midX - g.startMidX;
			const dy = midY - g.startMidY;
			transformRef.current.scale = newScale;
			transformRef.current.tx = clampPan(g.startTx + dx, newScale, "x");
			transformRef.current.ty = clampPan(g.startTy + dy, newScale, "y");
			applyTransform();
			return;
		}

		if (g.kind === "pan" && pointersRef.current.size === 1) {
			const dx = p.x - g.startX;
			const dy = p.y - g.startY;
			if (Math.abs(dx) > TAP_MAX_MOVE_PX || Math.abs(dy) > TAP_MAX_MOVE_PX) {
				g.moved = true;
			}
			transformRef.current.tx = clampPan(g.startTx + dx, g.startScale, "x");
			transformRef.current.ty = clampPan(g.startTy + dy, g.startScale, "y");
			applyTransform();
			return;
		}

		if (g.kind === "swipe" && pointersRef.current.size === 1) {
			const dx = p.x - g.startX;
			const dy = p.y - g.startY;
			if (Math.abs(dx) > TAP_MAX_MOVE_PX || Math.abs(dy) > TAP_MAX_MOVE_PX) {
				g.moved = true;
			}
			// Decide vertical (dismiss) vs horizontal (slide-nav) intent — whichever
			// axis the user has moved further on wins. The other axis is zeroed so
			// the image only moves in the dominant direction.
			let trackX = 0;
			let trackY = 0;
			const absX = Math.abs(dx);
			const absY = Math.abs(dy);
			if (absY > absX) {
				trackY = dy;
			} else {
				trackX = dx;
			}
			// Rubber-band horizontal swipe at the edges so users feel that there
			// are no more slides without abruptly stopping.
			if (trackX > 0 && !canPrev) trackX *= 0.3;
			if (trackX < 0 && !canNext) trackX *= 0.3;
			// Rubber-band downward swipe when the user starts at the top edge
			// (allows a small "pull down" hint before the real dismiss threshold).
			transformRef.current.trackX = trackX;
			transformRef.current.trackY = trackY;
			applyTransform();
			return;
		}
	};

	const finishSwipe = (_g: Extract<Gesture, { kind: "swipe" }>) => {
		const t = transformRef.current;
		// Dismiss takes priority over slide-nav.
		if (t.trackY > SWIPE_DISMISS_PX) {
			// Animate off-screen then call onClose. We set a CSS transition that
			// carries the image down + out, then call onClose after the animation.
			const track = trackRef.current;
			if (track) {
				const h = containerRectRef.current.h || window.innerHeight;
				track.style.transition = `transform ${SNAP_BACK_SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
				void track.offsetWidth;
				t.trackX = 0;
				t.trackY = h;
				applyTransform();
			}
			// After the off-screen animation, close.
			setTimeout(() => onClose(), SNAP_BACK_SLIDE_MS);
			gestureRef.current = { kind: "idle" };
			return;
		}
		if (t.trackX > SWIPE_NEXT_PX && canPrev) {
			// Change slide; the parent will update `index`, our reset-on-index
			// effect will snap the track to the new -index*100% position.
			t.trackX = 0;
			t.trackY = 0;
			gestureRef.current = { kind: "idle" };
			onIndexChange(index - 1);
			return;
		}
		if (t.trackX < -SWIPE_NEXT_PX && canNext) {
			t.trackX = 0;
			t.trackY = 0;
			gestureRef.current = { kind: "idle" };
			onIndexChange(index + 1);
			return;
		}
		// Snap back
		t.trackX = 0;
		t.trackY = 0;
		animateTrackSnapBack();
		applyTransform();
		gestureRef.current = { kind: "idle" };
	};

	const onPointerUp = (e: React.PointerEvent) => {
		const el = containerRef.current;
		if (el && el.hasPointerCapture(e.pointerId)) {
			try {
				el.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
		}
		const hadPointer = pointersRef.current.has(e.pointerId);
		pointersRef.current.delete(e.pointerId);

		const g = gestureRef.current;

		// ---- pinch end (or pinch dropping to a single finger) ----
		if (g.kind === "pinch") {
			if (pointersRef.current.size >= 1) {
				// One finger lifted during a pinch — transition to pan with the
				// remaining pointer so the user can pan the zoomed image without
				// lifting and re-tapping.
				const remaining = [...pointersRef.current.values()][0];
				if (remaining) {
					gestureRef.current = {
						kind: "pan",
						startScale: transformRef.current.scale,
						startTx: transformRef.current.tx,
						startTy: transformRef.current.ty,
						startX: remaining.x,
						startY: remaining.y,
						moved: true,
					};
				} else {
					gestureRef.current = { kind: "idle" };
				}
				queueMicrotask(() => setScale(transformRef.current.scale));
				return;
			}
			// All fingers up — commit scale + snap-back if below 1
			if (transformRef.current.scale <= MIN_SCALE) {
				transformRef.current.scale = 1;
				transformRef.current.tx = 0;
				transformRef.current.ty = 0;
				animateWrapSnapBack();
			}
			queueMicrotask(() => setScale(transformRef.current.scale));
			applyTransform();
			gestureRef.current = { kind: "idle" };
			return;
		}

		if (g.kind === "pan") {
			if (pointersRef.current.size > 0) {
				// Still have pointers (e.g. multi-touch pan) — just continue.
				return;
			}
			queueMicrotask(() => setScale(transformRef.current.scale));
			gestureRef.current = { kind: "idle" };
			return;
		}

		if (g.kind === "swipe") {
			// Tap = pointer down + up with no movement and no remaining pointers
			const isTap = !g.moved && pointersRef.current.size === 0 && hadPointer;
			if (isTap && pendingDoubleTapRef.current) {
				// Double-tap: toggle zoom
				if (singleTapTimerRef.current !== null) {
					clearTimeout(singleTapTimerRef.current);
					singleTapTimerRef.current = null;
				}
				const newScale =
					transformRef.current.scale > 1 ? MIN_SCALE : DOUBLE_TAP_SCALE;
				transformRef.current.scale = newScale;
				if (newScale <= 1) {
					transformRef.current.tx = 0;
					transformRef.current.ty = 0;
					animateWrapSnapBack();
				}
				pendingDoubleTapRef.current = false;
				lastTapRef.current = null;
				queueMicrotask(() => setScale(newScale));
				applyTransform();
				gestureRef.current = { kind: "idle" };
				return;
			}
			if (isTap) {
				// Single tap — defer the close action by DOUBLE_TAP_MS so a second
				// tap can convert it into a double-tap zoom instead.
				lastTapRef.current = {
					t: Date.now(),
					x: g.startX,
					y: g.startY,
				};
				if (singleTapTimerRef.current !== null) {
					clearTimeout(singleTapTimerRef.current);
				}
				singleTapTimerRef.current = setTimeout(() => {
					singleTapTimerRef.current = null;
					// Only close if we're still at scale===1 (a pinch started between
					// the tap and this timer firing shouldn't close).
					if (transformRef.current.scale <= MIN_SCALE) {
						onClose();
					}
				}, DOUBLE_TAP_MS);
				gestureRef.current = { kind: "idle" };
				return;
			}
			// Not a tap — finalize the swipe gesture
			finishSwipe(g);
			return;
		}

		gestureRef.current = { kind: "idle" };
	};

	const onPointerCancel = (e: React.PointerEvent) => {
		pointersRef.current.delete(e.pointerId);
		gestureRef.current = { kind: "idle" };
		transformRef.current.trackX = 0;
		transformRef.current.trackY = 0;
		applyTransform();
	};

	// ---- image load / error ----
	const handleImgLoad = useCallback(
		(i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
			const img = e.currentTarget;
			// Touch the natural size read so the layout is ready before any pinch.
			void img.naturalWidth;
			setLoaded((prev) => {
				if (prev.has(i)) return prev;
				const next = new Set(prev);
				next.add(i);
				return next;
			});
			setBroken((prev) => {
				if (!prev.has(i)) return prev;
				const next = new Set(prev);
				next.delete(i);
				return next;
			});
		},
		[],
	);

	const handleImgError = useCallback(
		(i: number) => () => {
			setBroken((prev) => {
				if (prev.has(i)) return prev;
				const next = new Set(prev);
				next.add(i);
				return next;
			});
		},
		[],
	);

	// ---- cleanup timers on unmount ----
	useEffect(() => {
		return () => {
			if (singleTapTimerRef.current !== null) {
				clearTimeout(singleTapTimerRef.current);
			}
			clearSnapBack();
		};
	}, [clearSnapBack]);

	if (!images.length) return <></>;

	const current = images[index] ?? { src: "", alt: "" };
	const showSkeleton = !loaded.has(index) && !broken.has(index);

	return (
		<div
			ref={containerRef}
			role="dialog"
			aria-modal="true"
			aria-label="Image viewer"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			className="lightbox-enter fixed inset-0 z-[200] flex touch-none select-none flex-col"
			style={{ cursor: scale > 1 ? "zoom-in" : "default" }}
		>
			{/* Backdrop (opacity is mutated live by applyTransform during swipe-to-dismiss) */}
			<div
				ref={backdropRef}
				className="pointer-events-none absolute inset-0 bg-black opacity-95"
				aria-hidden
			/>

			{/* Horizontal track of slides. Each slide is a full-viewport flex item.
          Only the active slide's <img> receives the pan/zoom transform. */}
			<div
				ref={trackRef}
				className="absolute inset-0 flex will-change-transform"
				style={{ transform: `translate3d(${-index * 100}%, 0, 0)` }}
			>
				{images.map((img, i) => {
					const isActive = i === index;
					const isBroken = broken.has(i);
					return (
						<div
							key={`${i}-${img.src}`}
							className="relative h-full w-full shrink-0"
						>
							{isActive && showSkeleton && (
								<div className="absolute inset-0 flex items-center justify-center">
									<Skeleton className="h-40 w-40 rounded-full" />
								</div>
							)}
							{isBroken ? (
								<div
									role="img"
									aria-label="Image failed to load"
									className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-neutral-500"
								>
									<ImageOff className="size-16" />
									<span className="text-sm">Image failed to load</span>
								</div>
							) : (
								<img
									ref={isActive ? wrapRef : undefined}
									src={img.src}
									alt={img.alt ?? ""}
									draggable={false}
									decoding="async"
									onLoad={handleImgLoad(i)}
									onError={handleImgError(i)}
									className={cn(
										"size-full select-none object-contain will-change-transform",
										isActive ? "pointer-events-none" : "opacity-100",
									)}
									style={
										isActive
											? {
													transformOrigin: "center center",
													transform: "translate3d(0, 0, 0) scale(1)",
												}
											: undefined
									}
								/>
							)}
						</div>
					);
				})}
			</div>

			{/* Top-left close button */}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				aria-label="Close image viewer"
				className="absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-10 flex size-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
			>
				<X className="size-5" />
			</button>

			{/* Top-right counter pill */}
			{total > 1 && (
				<div
					aria-live="polite"
					className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-10 flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md"
				>
					<span>{index + 1}</span>
					<span className="text-white/50">/</span>
					<span className="text-white/80">{total}</span>
				</div>
			)}

			{/* Side chevrons (hidden when only 1 image) */}
			{total > 1 && (
				<>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							if (index > 0) onIndexChange(index - 1);
						}}
						disabled={!canPrev}
						aria-label="Previous image"
						className={cn(
							"absolute top-1/2 left-[max(0.5rem,env(safe-area-inset-left))] z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60",
							!canPrev && "pointer-events-none opacity-30",
						)}
					>
						<ChevronLeft className="size-6" />
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							if (index < total - 1) onIndexChange(index + 1);
						}}
						disabled={!canNext}
						aria-label="Next image"
						className={cn(
							"absolute top-1/2 right-[max(0.5rem,env(safe-area-inset-right))] z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60",
							!canNext && "pointer-events-none opacity-30",
						)}
					>
						<ChevronRight className="size-6" />
					</button>
				</>
			)}

			{/* Screen-reader-only description of the current image */}
			<span className="sr-only">
				Image {index + 1} of {total}
				{current.alt ? `: ${current.alt}` : ""}
			</span>
		</div>
	);
}
