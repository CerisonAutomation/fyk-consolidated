/**
 * Swipe-to-reply gesture hook for React.
 * Converted from open-grind's Svelte SwipeToReply class.
 *
 * Simplified for web: supports touch and pointer-based swipe gestures
 * without Tauri/macOS-specific rail/bridge modes.
 *
 * Returns a ref to attach to the message row and the current drag state.
 */

import { useCallback, useRef, useState } from "react";

const TRIGGER_DISTANCE_PX = 64;
export const MAX_DRAG_PX = 92;
const AXIS_LOCK_SLOP_PX = 8;

export interface SwipeToReplyState {
	/** Current horizontal offset in pixels (positive = swiped right) */
	deltaX: number;
	/** Whether the user is actively dragging horizontally */
	dragging: boolean;
	/** Whether the swipe has crossed the reply trigger threshold */
	armed: boolean;
	/** Normalized progress from 0 to 1 based on trigger distance */
	progress: number;
}

export interface UseSwipeToReplyOptions {
	/** Direction that triggers reply: "right" means swipe right to reply */
	direction?: "left" | "right";
	/** Callback when swipe crosses the trigger threshold and is released */
	onReply: () => void;
}

export function useSwipeToReply({
	direction = "right",
	onReply,
}: UseSwipeToReplyOptions) {
	const [state, setState] = useState<SwipeToReplyState>({
		deltaX: 0,
		dragging: false,
		armed: false,
		progress: 0,
	});

	const dragSign = direction === "right" ? 1 : -1;
	const pointerIdRef = useRef<number | null>(null);
	const startRef = useRef({ x: 0, y: 0 });
	const axisRef = useRef<"undecided" | "horizontal">("undecided");

	const updateState = useCallback((updates: Partial<SwipeToReplyState>) => {
		setState((prev) => {
			const next = { ...prev, ...updates };
			if (updates.deltaX !== undefined) {
				next.progress = Math.min(
					Math.abs(updates.deltaX) / TRIGGER_DISTANCE_PX,
					1,
				);
			}
			return next;
		});
	}, []);

	const reset = useCallback(() => {
		pointerIdRef.current = null;
		axisRef.current = "undecided";
		updateState({ deltaX: 0, dragging: false, armed: false });
	}, [updateState]);

	const onPointerDown = useCallback((event: React.PointerEvent) => {
		pointerIdRef.current = event.pointerId;
		startRef.current = { x: event.clientX, y: event.clientY };
		axisRef.current = "undecided";
	}, []);

	const onPointerMove = useCallback(
		(event: React.PointerEvent) => {
			if (event.pointerId !== pointerIdRef.current) return;

			const deltaX = event.clientX - startRef.current.x;
			const deltaY = event.clientY - startRef.current.y;

			if (axisRef.current === "undecided") {
				if (Math.abs(deltaY) > AXIS_LOCK_SLOP_PX) {
					reset();
					return;
				}
				if (Math.abs(deltaX) <= AXIS_LOCK_SLOP_PX) return;
				axisRef.current = "horizontal";
			}

			const magnitude = Math.min(Math.max(deltaX * dragSign, 0), MAX_DRAG_PX);
			updateState({
				deltaX: magnitude * dragSign,
				dragging: true,
				armed: magnitude > TRIGGER_DISTANCE_PX,
			});
		},
		[dragSign, reset, updateState],
	);

	const onPointerUp = useCallback(
		(event: React.PointerEvent) => {
			if (event.pointerId !== pointerIdRef.current) return;
			const shouldReply = state.armed;
			reset();
			if (shouldReply) onReply();
		},
		[state.armed, reset, onReply],
	);

	const onPointerCancel = useCallback(
		(event: React.PointerEvent) => {
			if (event.pointerId !== pointerIdRef.current) return;
			reset();
		},
		[reset],
	);

	return {
		state,
		handlers: {
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel,
		},
	};
}
