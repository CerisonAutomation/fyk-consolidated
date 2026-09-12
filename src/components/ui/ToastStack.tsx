import { X } from "lucide-react";
import { useToasts } from "#/lib/toast";

/**
 * The only place the toast store is read for display. The live region is what makes a
 * toast that replaced an inline spinner still get announced. The stack is
 * pointer-transparent except for the dismiss control, so it never eats a tap meant
 * for the page underneath.
 */
export function ToastStack() {
	const toasts = useToasts((state) => state.toasts);
	const dismiss = useToasts((state) => state.dismiss);

	if (toasts.length === 0) return null;

	return (
		<div
			aria-live="polite"
			aria-atomic="true"
			className="pointer-events-none fixed inset-0 z-[80] flex items-end justify-center p-4"
		>
			<div className="pointer-events-auto w-full max-w-sm">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={
							toast.tone === "error"
								? "press flex items-start gap-3 rounded-2xl border border-live/30 bg-[oklch(0.24_0.05_25)] px-4 py-3.5 text-[14px] leading-relaxed text-ink shadow-[var(--shadow-pop)]"
								: "flex items-start gap-3 rounded-2xl border border-gold/30 bg-surface-2 px-4 py-3.5 text-[14px] leading-relaxed text-ink shadow-[var(--shadow-pop)]"
						}
					>
						<p className="flex-1">{toast.message}</p>
						<button
							type="button"
							aria-label="Dismiss"
							className="text-muted transition-colors hover:text-ink"
							onClick={() => dismiss(toast.id)}
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
