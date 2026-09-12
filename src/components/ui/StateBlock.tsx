import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { ApiClientError } from "#/lib/client";
import { cn } from "#/lib/utils";

/**
 * One component for loading / empty / error, because the failure mode of most
 * product surfaces is "quietly nothing": an empty array and a failed request look
 * identical unless the state is named out loud.
 */
export function StateBlock({
	kind,
	title,
	description,
	action,
	className,
}: {
	kind: "loading" | "empty" | "error" | "disabled";
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}) {
	const Icon =
		kind === "loading"
			? Loader2
			: kind === "error" || kind === "disabled"
				? AlertTriangle
				: Inbox;
	return (
		<div
			role={kind === "error" ? "alert" : "status"}
			aria-busy={kind === "loading"}
			className={cn(
				"flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-14 text-center",
				className,
			)}
		>
			<span
				className={cn(
					"mb-4 grid h-12 w-12 place-items-center rounded-2xl",
					kind === "error"
						? "bg-live/10 text-live"
						: kind === "disabled"
							? "bg-white/5 text-muted"
							: "bg-gold/10 text-gold",
				)}
			>
				<Icon
					className={cn("h-5 w-5", kind === "loading" && "animate-spin")}
					aria-hidden="true"
				/>
			</span>
			<h3 className="text-[15px] font-semibold text-ink">{title}</h3>
			{description ? (
				<p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
					{description}
				</p>
			) : null}
			{action ? <div className="mt-5">{action}</div> : null}
		</div>
	);
}

/** Turns any thrown value into copy a user can act on, and nothing else. */
export function describeFailure(
	error: unknown,
	fallback = "We couldn't load that right now.",
): { message: string; retryable: boolean; requestId: string | null } {
	if (error instanceof ApiClientError) {
		return {
			message: error.message,
			retryable: error.retryable || error.status >= 500,
			requestId: error.requestId,
		};
	}
	return { message: fallback, retryable: true, requestId: null };
}
