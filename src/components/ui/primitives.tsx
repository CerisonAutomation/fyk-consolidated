import { Inbox } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
	children,
	color = "gold",
	className,
}: {
	children: ReactNode;
	color?: "gold" | "blue" | "green" | "purple" | "slate" | "rose";
	className?: string;
}) {
	const colors: Record<string, string> = {
		gold: "bg-gold/15 text-gold-soft border-gold/30",
		blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
		green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
		purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
		slate: "bg-white/5 text-slate-300 border-white/10",
		rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
	};
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
				colors[color],
				className,
			)}
		>
			{children}
		</span>
	);
}

export function Skeleton({ className }: { className?: string }) {
	return <div className={cn("skeleton rounded-lg", className)} />;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
}: {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
			<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
				{icon ?? <Inbox className="h-6 w-6" />}
			</div>
			<h3 className="text-base font-semibold text-white">{title}</h3>
			{description && (
				<p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
};

export function Button({
	variant = "primary",
	size = "md",
	className,
	children,
	...props
}: ButtonProps) {
	const variants: Record<string, string> = {
		primary:
			"bg-gold text-ink font-semibold hover:bg-gold-soft disabled:opacity-50",
		secondary:
			"bg-surface-2 text-white border border-line hover:bg-line/50 disabled:opacity-50",
		ghost: "text-muted hover:text-white hover:bg-white/5 disabled:opacity-50",
		danger: "bg-rose-600/90 text-white hover:bg-rose-600 disabled:opacity-50",
	};
	const sizes: Record<string, string> = {
		sm: "h-8 px-3 text-xs",
		md: "h-10 px-4 text-sm",
		lg: "h-12 px-6 text-base",
	};
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}

export function Spinner({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white",
				className,
			)}
		/>
	);
}
