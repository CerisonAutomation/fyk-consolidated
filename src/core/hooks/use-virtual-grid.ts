/**
 * Virtual grid hook for React.
 * Converted from open-grind's Svelte virtualGrid.
 *
 * Provides grid virtualization: given a grid container element and item count,
 * returns the visible range and padding offsets for efficient rendering.
 *
 * Uses ResizeObserver and scroll events to track viewport changes.
 */

import { useCallback, useRef, useState } from "react";
import { gridWindow, type GridMetrics } from "../lib/grid-window";

const OVERSCAN_PX = 600;

function nearestScrollableAncestor(el: HTMLElement): HTMLElement | null {
	let node: HTMLElement | null = el.parentElement;
	while (node) {
		const style = getComputedStyle(node);
		const overflowY = style.overflowY;
		const overflowX = style.overflowX;
		if (
			overflowY === "auto" ||
			overflowY === "scroll" ||
			overflowX === "auto" ||
			overflowX === "scroll"
		) {
			return node;
		}
		node = node.parentElement;
	}
	return document.documentElement;
}

export interface VirtualGridResult {
	startIndex: number;
	endIndex: number;
	paddingTopPx: number;
	paddingBottomPx: number;
	hasRowsAbove: boolean;
	hasRowsBelow: boolean;
}

export interface UseVirtualGridOptions {
	/** Number of items in the grid */
	count: number;
}

export function useVirtualGrid({ count }: UseVirtualGridOptions) {
	const [metrics, setMetrics] = useState<GridMetrics>({
		columns: 0,
		cellPx: 0,
		gapPx: 0,
	});
	const [offsetPx, setOffsetPx] = useState(0);
	const [viewportPx, setViewportPx] = useState(0);

	const gridRef = useRef<HTMLElement | null>(null);
	const scrollerRef = useRef<HTMLElement | null>(null);

	const measure = useCallback(() => {
		const el = gridRef.current;
		if (!el) return;
		const style = getComputedStyle(el);
		const tracks = style.gridTemplateColumns.trim().split(/\s+/);
		setMetrics({
			columns: tracks.length,
			cellPx: Number.parseFloat(tracks[0] ?? "") || 0,
			gapPx: Number.parseFloat(style.rowGap) || 0,
		});
	}, []);

	const sample = useCallback(() => {
		const el = gridRef.current;
		const scroller = scrollerRef.current;
		if (!el || !scroller) return;
		const view = scroller.getBoundingClientRect();
		setOffsetPx(view.top - el.getBoundingClientRect().top);
		setViewportPx(view.height);
	}, []);

	const setGridElement = useCallback(
		(node: HTMLElement | null) => {
			// Cleanup previous observers
			const prevScroller = scrollerRef.current;
			if (prevScroller) {
				prevScroller.removeEventListener("scroll", sample);
			}

			gridRef.current = node;

			if (!node) {
				setMetrics({ columns: 0, cellPx: 0, gapPx: 0 });
				return;
			}

			const scroller = nearestScrollableAncestor(node);
			scrollerRef.current = scroller;

			measure();
			sample();

			const resize = new ResizeObserver(() => {
				measure();
				sample();
			});
			resize.observe(node);
			if (scroller && scroller !== node) {
				resize.observe(scroller);
			}

			scroller?.addEventListener("scroll", sample, { passive: true });

			// Store cleanup
			const cleanup = () => {
				resize.disconnect();
				scroller?.removeEventListener("scroll", sample);
			};
			(
				node as HTMLElement & { _virtualGridCleanup?: () => void }
			)._virtualGridCleanup = cleanup;
		},
		[measure, sample],
	);

	const result = gridWindow({
		count,
		metrics,
		offsetPx,
		viewportPx,
		overscanPx: OVERSCAN_PX,
	});

	return {
		...result,
		ref: setGridElement,
	};
}
