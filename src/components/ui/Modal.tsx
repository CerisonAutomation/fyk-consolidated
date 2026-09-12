import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "#/utils/cn";

export function Modal({
	open,
	onClose,
	children,
	labelledBy,
	wide,
}: {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
	labelledBy?: string;
	wide?: boolean;
}) {
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		// Store the element that had focus before the modal opened
		previousFocusRef.current = document.activeElement as HTMLElement;

		// Focus the first focusable element in the dialog
		const timer = setTimeout(() => {
			const dialog = dialogRef.current;
			if (!dialog) return;
			const firstFocusable = dialog.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			firstFocusable?.focus();
		}, 50);

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			// Trap focus within the dialog
			if (e.key === "Tab") {
				const dialog = dialogRef.current;
				if (!dialog) return;
				const focusables = dialog.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
				);
				if (focusables.length === 0) return;
				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};

		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			clearTimeout(timer);
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
			// Restore focus to the element that triggered the modal
			previousFocusRef.current?.focus();
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
			<div
				className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-[3px]"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={labelledBy}
				className={cn(
					"anim-sheet relative max-h-[92svh] w-full overflow-y-auto scroll-thin rounded-t-3xl border border-line bg-surface shadow-[var(--shadow-pop)] sm:rounded-3xl",
					wide ? "sm:max-w-3xl" : "sm:max-w-lg",
				)}
			>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="press absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-black/45 text-white backdrop-blur hover:bg-black/65"
				>
					<X className="h-[18px] w-[18px]" />
				</button>
				{children}
			</div>
		</div>
	);
}
