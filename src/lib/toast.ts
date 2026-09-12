/**
 * Toast queue. Replaces the 280-line app "god store" that also held view ids for
 * screens which no longer exist and a call/media state nothing could start.
 */

import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";
export type Toast = { id: string; message: string; tone: ToastTone };

interface ToastState {
	toasts: Toast[];
	push: (message: string, tone?: ToastTone) => void;
	dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
	toasts: [],
	push: (message, tone = "info") => {
		const id = Math.random().toString(36).slice(2, 10);
		set((state) => ({
			toasts: [...state.toasts.slice(-2), { id, message, tone }],
		}));
		// Auto-dismiss; a toast that needs a decision is a dialog, not a toast.
		setTimeout(
			() =>
				set((state) => ({
					toasts: state.toasts.filter((toast) => toast.id !== id),
				})),
			tone === "error" ? 6000 : 3500,
		);
	},
	dismiss: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((toast) => toast.id !== id),
		})),
}));

/** Components call this instead of reaching for the store, so error toasts are uniform. */
export function toastError(error: unknown, fallback = "Something went wrong.") {
	const message =
		error instanceof Error && error.message ? error.message : fallback;
	useToasts.getState().push(message, "error");
}
