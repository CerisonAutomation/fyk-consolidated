/**
 * Long-press (plus right-click) detection for chat message actions.
 *
 * Two rules that matter on touch devices, learned the hard way by every app that
 * gets them wrong:
 *   - the gesture is cancelled as soon as the finger moves more than a few pixels,
 *     so scrolling never opens a context menu;
 *   - the click that follows a long press is suppressed briefly, otherwise the
 *     menu opens and the action underneath it fires at the same time.
 */

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_HOLD_MS = 380;
const MOVE_TOLERANCE_PX = 12;
const SUPPRESS_CLICK_MS = 600;

let suppressClickUntil = 0;
let suppressorAttached = false;

function ensureClickSuppressor(): void {
	if (suppressorAttached || typeof window === "undefined") return;
	suppressorAttached = true;
	window.addEventListener(
		"click",
		(event) => {
			if (Date.now() > suppressClickUntil) return;
			event.preventDefault();
			event.stopPropagation();
		},
		true,
	);
}

export function useLongPress(
	onLongPress: () => void,
	holdMs = DEFAULT_HOLD_MS,
) {
	const timer = useRef<number | null>(null);
	const origin = useRef<{ x: number; y: number } | null>(null);
	const handler = useRef(onLongPress);
	handler.current = onLongPress;

	const clear = useCallback(() => {
		if (timer.current !== null) {
			window.clearTimeout(timer.current);
			timer.current = null;
		}
		origin.current = null;
	}, []);

	useEffect(() => {
		ensureClickSuppressor();
		return clear;
	}, [clear]);

	const fire = useCallback(() => {
		clear();
		suppressClickUntil = Date.now() + SUPPRESS_CLICK_MS;
		handler.current();
	}, [clear]);

	return {
		onTouchStart: (event: React.TouchEvent) => {
			const touch = event.touches[0];
			if (!touch) return;
			origin.current = { x: touch.clientX, y: touch.clientY };
			timer.current = window.setTimeout(fire, holdMs);
		},
		onTouchMove: (event: React.TouchEvent) => {
			const touch = event.touches[0];
			const start = origin.current;
			if (!touch || !start) return;
			if (
				Math.abs(touch.clientX - start.x) > MOVE_TOLERANCE_PX ||
				Math.abs(touch.clientY - start.y) > MOVE_TOLERANCE_PX
			)
				clear();
		},
		onTouchEnd: clear,
		onTouchCancel: clear,
		onMouseDown: (event: React.MouseEvent) => {
			if (event.button !== 0) return;
			timer.current = window.setTimeout(fire, holdMs);
		},
		onMouseUp: clear,
		onMouseLeave: clear,
		// Right-click is the desktop equivalent of the hold, and the menu it opens is
		// the same one — without this the docstring above would be a claim about a
		// gesture the code never handled.
		onContextMenu: (event: React.MouseEvent) => {
			event.preventDefault();
			fire();
		},
	};
}
