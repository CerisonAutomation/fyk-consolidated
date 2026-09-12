import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "#/lib/utils";

const FOCUSABLE =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one dialog shell in the app: report flow, event creation, moderation
 * decisions. Everything hard about a modal is handled here so a page cannot get
 * it wrong by half:
 *
 * - the trap listens while the dialog is open and ignores `onClose` identity.
 *   Callers pass an inline arrow; re-subscribing (and re-locking scroll, and
 *   re-focusing the trigger) on every parent render would yank the caret out of
 *   the textarea mid-sentence;
 * - `Escape` closes, `Tab` is trapped, and focus returns to whatever opened it —
 *   but only if that element is still on the page;
 * - the dialog is labelled by `labelledBy` when the caller has a heading and by
 *   `label` otherwise, so an unnamed dialog cannot ship.
 */
export function Modal({
	open,
	onClose,
	children,
	labelledBy,
	label,
	wide,
}: {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
	labelledBy?: string;
	label?: string;
	wide?: boolean;
}) {
	const dialogRef = useRef<HTMLDivElement | null>(null);
	// A ref, not an effect dependency: the handler must always see the current
	// callback without the subscription being torn down and rebuilt around it.
	const closeRef = useRef(onClose);
	closeRef.current = onClose;

	useEffect(() => {
		if (!open) return;
		const dialog = dialogRef.current;
		const opener = document.activeElement as HTMLElement | null;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		// One frame of delay: the sheet animates in, and focusing earlier would
		// scroll the page behind it before the layout has settled.
		const frame = requestAnimationFrame(() => {
			if (!dialog) return;
			if (dialog.contains(document.activeElement)) return;
			// Prefer the first field: a dialog that is a form should be ready to type
			// in. With no field, focus the dialog itself — that announces the title,
			// and the first Tab lands on the first control. Focusing the close button
			// instead is the classic way to let an Enter keypress dismiss a report
			// the user meant to send.
			const field = dialog.querySelector<HTMLElement>(
				'input:not([type="hidden"]), textarea, select',
			);
			(field ?? dialog).focus({ preventScroll: true });
		});

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				closeRef.current();
				return;
			}
			if (event.key !== "Tab" || !dialog) return;
			const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
			if (focusables.length === 0) {
				event.preventDefault();
				return;
			}
			const first = focusables[0] as HTMLElement;
			const last = focusables[focusables.length - 1] as HTMLElement;
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === dialog)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown, true);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", onKeyDown, true);
			document.body.style.overflow = previousOverflow;
			if (opener?.isConnected) opener.focus({ preventScroll: true });
		};
	}, [open]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
			<button
				type="button"
				tabIndex={-1}
				aria-hidden="true"
				onClick={onClose}
				className="anim-fade absolute inset-0 cursor-default bg-black/70 backdrop-blur-[3px]"
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={labelledBy}
				aria-label={labelledBy ? undefined : (label ?? "Dialog")}
				tabIndex={-1}
				className={cn(
					"anim-sheet relative max-h-[92svh] w-full overflow-y-auto scroll-thin rounded-t-3xl border border-line bg-surface shadow-[var(--shadow-pop)] outline-none sm:rounded-3xl",
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
