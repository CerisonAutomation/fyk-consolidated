/**
 * Long press gesture hook for React.
 * Converted from open-grind's Svelte long-press utility.
 *
 * Returns event handlers to attach to an element for long-press detection.
 * Supports both touch long-press and right-click context menu.
 */

import { useCallback, useRef } from "react";

const LONG_PRESS_DURATION_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const NATIVE_CONTEXTMENU_DELAY_MS = 500;
const CLICK_SUPPRESS_MS = 700;

let lastFiredAt = 0;
let suppressClickUntil = 0;
let clickSuppressorAttached = false;

function fireOnce(onLongPress: () => void): void {
	const now = Date.now();
	if (now - lastFiredAt < NATIVE_CONTEXTMENU_DELAY_MS) return;
	lastFiredAt = now;
	onLongPress();
}

function onGlobalClickCapture(event: MouseEvent): void {
	if (suppressClickUntil === 0) return;
	if (Date.now() > suppressClickUntil) {
		suppressClickUntil = 0;
		return;
	}
	suppressClickUntil = 0;
	event.preventDefault();
	event.stopPropagation();
}

function suppressNextClick(): void {
	suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
	if (clickSuppressorAttached || typeof document === "undefined") return;
	clickSuppressorAttached = true;
	document.addEventListener("click", onGlobalClickCapture, { capture: true });
}

export interface LongPressHandlers {
	onPointerDown: (event: React.PointerEvent) => void;
	onPointerMove: (event: React.PointerEvent) => void;
	onPointerUp: (event: React.PointerEvent) => void;
	onPointerCancel: (event: React.PointerEvent) => void;
	onContextMenu: (event: React.MouseEvent) => void;
}

export function useLongPress(onLongPress: () => void): LongPressHandlers {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const originRef = useRef({ x: 0, y: 0 });
	const pressConsumedRef = useRef(false);

	const cancel = useCallback(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const onPointerDown = useCallback(
		(event: React.PointerEvent) => {
			pressConsumedRef.current = false;
			cancel();
			if (event.pointerType === "mouse") return;
			originRef.current = { x: event.clientX, y: event.clientY };
			timerRef.current = setTimeout(() => {
				timerRef.current = null;
				pressConsumedRef.current = true;
				fireOnce(onLongPress);
			}, LONG_PRESS_DURATION_MS);
		},
		[cancel, onLongPress],
	);

	const onPointerMove = useCallback(
		(event: React.PointerEvent) => {
			if (timerRef.current === null) return;
			const dx = Math.abs(event.clientX - originRef.current.x);
			const dy = Math.abs(event.clientY - originRef.current.y);
			if (
				dx > LONG_PRESS_MOVE_TOLERANCE_PX ||
				dy > LONG_PRESS_MOVE_TOLERANCE_PX
			) {
				cancel();
			}
		},
		[cancel],
	);

	const onPointerUp = useCallback(
		(event: React.PointerEvent) => {
			cancel();
			if (pressConsumedRef.current && event.pointerType !== "mouse") {
				suppressNextClick();
			}
		},
		[cancel],
	);

	const onPointerCancel = useCallback(() => {
		cancel();
	}, [cancel]);

	const onContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			cancel();
			if (!pressConsumedRef.current) {
				pressConsumedRef.current = true;
				fireOnce(onLongPress);
			}
		},
		[cancel, onLongPress],
	);

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		onContextMenu,
	};
}
