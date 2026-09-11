"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { memo } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Toaster — renders toast notifications with proper ARIA attributes.
 * Per the accessibility docs: "Use role='status' and aria-live for dynamic content".
 * Uses React.memo to prevent unnecessary re-renders when parent state changes.
 */
export const Toaster = memo(function Toaster() {
	const toasts = useAppStore((s) => s.toasts);
	const dismiss = useAppStore((s) => s.dismissToast);

	if (toasts.length === 0) return null;

	return (
		<div
			className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
			role="status"
			aria-live="polite"
			aria-label="Notifications"
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					className={cn(
						"pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur animate-in",
						t.type === "success" &&
							"border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
						t.type === "error" &&
							"border-rose-500/30 bg-rose-500/10 text-rose-100",
						t.type === "info" && "border-gold/30 bg-gold/10 text-gold-soft",
					)}
					role={t.type === "error" ? "alert" : undefined}
				>
					{t.type === "success" && (
						<CheckCircle2
							className="h-4 w-4 text-emerald-400"
							aria-hidden="true"
						/>
					)}
					{t.type === "error" && (
						<AlertCircle className="h-4 w-4 text-rose-400" aria-hidden="true" />
					)}
					{t.type === "info" && (
						<Info className="h-4 w-4 text-gold" aria-hidden="true" />
					)}
					<span>{t.message}</span>
					<button
						type="button"
						onClick={() => dismiss(t.id)}
						className="ml-1 opacity-60 hover:opacity-100"
						aria-label="Dismiss notification"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			))}
		</div>
	);
});
