import { RefreshCw } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "#/lib/utils";

const THRESHOLD = 64;
const MAX_PULL = 110;

/**
 * Pull-to-refresh for touch devices.
 *
 * Guarded against the three ways this gesture usually misbehaves in a mobile web
 * app: it never fires when the scroll container is not at the top, it releases the
 * pointer lock on touchcancel, and it refuses to start on a horizontal drag so it
 * cannot fight a swipe-to-reply gesture.
 */
export function PullToRefresh({
	onRefresh,
	children,
	className,
	disabled = false,
}: {
	onRefresh: () => Promise<void>;
	children: ReactNode;
	className?: string;
	disabled?: boolean;
}) {
	const [pull, setPull] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const startY = useRef<number | null>(null);
	const scroller = useRef<HTMLElement | null>(null);

	const findScroller = useCallback((node: HTMLElement | null) => {
		let current: HTMLElement | null = node;
		while (current && current !== document.body) {
			const { overflowY } = window.getComputedStyle(current);
			if (overflowY === "auto" || overflowY === "scroll") return current;
			current = current.parentElement;
		}
		return document.scrollingElement as HTMLElement | null;
	}, []);

	const onTouchStart = useCallback(
		(event: React.TouchEvent) => {
			if (disabled || refreshing) return;
			const root =
				(event.target as HTMLElement).closest("[data-pull-root]") ??
				(event.currentTarget as HTMLElement);
			const scrollerNode = findScroller(root as HTMLElement);
			scroller.current = scrollerNode;
			const atTop = !scrollerNode || scrollerNode.scrollTop <= 0;
			if (!atTop) {
				startY.current = null;
				return;
			}
			startY.current = event.touches[0]?.clientY ?? null;
		},
		[disabled, findScroller, refreshing],
	);

	const onTouchMove = useCallback(
		(event: React.TouchEvent) => {
			if (startY.current == null || refreshing) return;
			const delta =
				(event.touches[0]?.clientY ?? startY.current) - startY.current;
			if (delta <= 0) {
				setPull(0);
				return;
			}
			if (scroller.current && scroller.current.scrollTop > 0) {
				startY.current = null;
				setPull(0);
				return;
			}
			// Damped so a long drag does not fling the indicator across the screen.
			setPull(Math.min(MAX_PULL, delta * 0.5));
		},
		[refreshing],
	);

	const onTouchEnd = useCallback(async () => {
		const shouldRefresh = pull >= THRESHOLD;
		startY.current = null;
		setPull(0);
		if (!shouldRefresh || refreshing) return;
		setRefreshing(true);
		try {
			await onRefresh();
		} finally {
			setRefreshing(false);
		}
	}, [onRefresh, pull, refreshing]);

	useEffect(() => {
		if (refreshing) setPull(MAX_PULL * 0.6);
	}, [refreshing]);

	return (
		<div
			data-pull-root
			className={cn("relative touch-pan-y", className)}
			onTouchStart={onTouchStart}
			onTouchMove={onTouchMove}
			onTouchEnd={() => void onTouchEnd()}
			onTouchCancel={() => {
				startY.current = null;
				setPull(0);
			}}
		>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 flex h-0 items-center justify-center"
				style={{ height: Math.max(0, pull) }}
				aria-hidden={!refreshing && pull === 0}
			>
				<span
					className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-gold shadow-[var(--shadow-sm)] transition-transform"
					style={{
						transform: `rotate(${(pull / MAX_PULL) * 270}deg) scale(${refreshing ? 1 : 0.7 + (pull / MAX_PULL) * 0.3})`,
					}}
				>
					<RefreshCw className="h-4 w-4" />
				</span>
			</div>
			<div
				className={cn(
					"transition-transform duration-150",
					pull > 0 && !refreshing && "duration-0",
				)}
				style={{ transform: `translateY(${pull}px)` }}
			>
				{children}
			</div>
		</div>
	);
}
