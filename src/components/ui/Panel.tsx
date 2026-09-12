import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Panel({
	children,
	className,
	as: Tag = "section",
}: {
	children: ReactNode;
	className?: string;
	as?: React.ElementType;
}) {
	return (
		<Tag
			className={cn(
				"rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]",
				className,
			)}
		>
			{children}
		</Tag>
	);
}

export function DataModeNotice({
	title = "Local preview",
	children,
	compact = false,
}: {
	title?: string;
	children: ReactNode;
	compact?: boolean;
}) {
	return (
		<div
			role="note"
			className={cn(
				"flex items-start gap-3 border border-violet/25 bg-violet-ghost text-ink-2",
				compact ? "rounded-xl px-3 py-2.5" : "rounded-2xl px-4 py-3.5",
			)}
		>
			<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet" />
			<p
				className={cn(
					"leading-relaxed",
					compact ? "text-[11.5px]" : "text-[12.5px]",
				)}
			>
				<strong className="font-semibold text-violet">{title}.</strong>{" "}
				{children}
			</p>
		</div>
	);
}
