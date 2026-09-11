import { type ReactNode } from "react";
import { cn } from "#/lib/utils";

/* ================================================================== */
/*  FYK Premium Design System Primitives                               */
/*  Extracted from ZENITH canonical — glass cards, gold accents, etc.  */
/* ================================================================== */

/* ── Glass Card ───────────────────────────────────────────────────── */

export function GlassCard({
	children,
	className,
	hover = false,
}: {
	children: ReactNode;
	className?: string;
	hover?: boolean;
}) {
	return (
		<div
			className={cn(
				"glass-card",
				hover && "card-glow cursor-pointer",
				className,
			)}
		>
			{children}
		</div>
	);
}

/* ── Section Header (gold mono label) ─────────────────────────────── */

export function SectionHeader({
	label,
	className,
}: {
	label: string;
	className?: string;
}) {
	return (
		<p
			className={cn(
				"font-mono uppercase tracking-[0.25em] text-gold mb-3",
				className,
			)}
			style={{ fontSize: "10px" }}
		>
			{label}
		</p>
	);
}

/* ── Pill Tag ─────────────────────────────────────────────────────── */

export function PillTag({
	children,
	color = "var(--accent-primary)",
}: {
	children: ReactNode;
	color?: string;
}) {
	return (
		<span
			className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono uppercase tracking-wider"
			style={{
				fontSize: "10px",
				color,
				background: `color-mix(in srgb, ${color} 15%, transparent)`,
				border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
			}}
		>
			{children}
		</span>
	);
}

/* ── Stat Item ────────────────────────────────────────────────────── */

export function StatItem({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon: React.FC<{ className?: string }>;
}) {
	return (
		<div className="glass-card p-3 flex flex-col items-center gap-1.5">
			<div
				className="w-9 h-9 rounded-xl flex items-center justify-center"
				style={{
					background:
						"color-mix(in srgb, var(--accent-primary) 12%, transparent)",
				}}
			>
				<Icon className="w-4 h-4 text-gold" />
			</div>
			<div className="text-center">
				<p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
					{label}
				</p>
				<p className="font-display text-sm text-foreground/90">{value}</p>
			</div>
		</div>
	);
}

/* ── Settings Item Row ────────────────────────────────────────────── */

export function SettingsRow({
	icon: Icon,
	label,
	description,
	href,
	onClick,
	color = "var(--accent-primary)",
	badge,
}: {
	icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
	label: string;
	description?: string;
	href?: string;
	onClick?: () => void;
	color?: string;
	badge?: ReactNode;
}) {
	const content = (
		<div className="flex items-center gap-3 py-2.5">
			<div
				className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
				style={{
					background: `color-mix(in srgb, ${color} 12%, transparent)`,
				}}
			>
				<Icon className="w-5 h-5" style={{ color }} />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium text-foreground/90">
						{label}
					</span>
					{badge}
				</div>
				{description && (
					<p className="text-xs text-muted-foreground/60 mt-0.5">
						{description}
					</p>
				)}
			</div>
			<svg
				className="w-4 h-4 text-muted-foreground/30 shrink-0"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="m9 18 6-6-6-6" />
			</svg>
		</div>
	);

	if (href) {
		return (
			<a
				href={href}
				className="block rounded-xl px-3 transition-all duration-200 hover:bg-white/[0.03] group"
			>
				{content}
			</a>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			className="w-full text-left rounded-xl px-3 transition-all duration-200 hover:bg-white/[0.03] group"
		>
			{content}
		</button>
	);
}

/* ── Verified Badge ───────────────────────────────────────────────── */

export function VerifiedBadge({
	size = 16,
	className,
}: {
	size?: number;
	className?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			className={cn("inline-block shrink-0", className)}
			aria-label="Verified"
		>
			<path
				d="M12 2 L14.5 4 L17.5 4 L18.5 6.5 L21 7.5 L20.5 10.5 L22 12 L20.5 13.5 L21 16.5 L18.5 17.5 L17.5 20 L14.5 20 L12 22 L9.5 20 L6.5 20 L5.5 17.5 L3 16.5 L3.5 13.5 L2 12 L3.5 10.5 L3 7.5 L5.5 6.5 L6.5 4 L9.5 4 Z"
				fill="var(--accent-primary)"
			/>
			<path
				d="M8 12 L11 15 L16 9"
				stroke="#000"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
		</svg>
	);
}

/* ── Online Status Indicator ──────────────────────────────────────── */

export function OnlineIndicator({ isOnline }: { isOnline: boolean }) {
	if (!isOnline) return null;
	return (
		<span className="relative flex items-center gap-1.5">
			<span className="relative flex h-2.5 w-2.5">
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
				<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
			</span>
			<span className="text-[10px] font-mono uppercase tracking-widest text-green-400/80">
				Online
			</span>
		</span>
	);
}

/* ── Empty State ──────────────────────────────────────────────────── */

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: React.FC<{ className?: string }>;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
			<div
				className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
				style={{
					background:
						"color-mix(in srgb, var(--accent-primary) 8%, transparent)",
				}}
			>
				<Icon className="w-8 h-8 text-gold/40" />
			</div>
			<h3 className="text-lg font-display text-foreground/80 tracking-wide mb-1">
				{title}
			</h3>
			{description && (
				<p className="text-sm text-muted-foreground/60 max-w-xs mb-4">
					{description}
				</p>
			)}
			{action}
		</div>
	);
}

/* ── Profile Skeleton Loader ──────────────────────────────────────── */

export function ProfileCardSkeleton() {
	return (
		<div className="aspect-[3/4] rounded-2xl overflow-hidden glass-card">
			<div className="h-full w-full skeleton-pulse" />
			<div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
				<div className="h-3 w-24 rounded bg-white/20 skeleton-pulse mb-1" />
				<div className="h-2 w-16 rounded bg-white/10 skeleton-pulse" />
			</div>
		</div>
	);
}

/* ── Chat List Skeleton ───────────────────────────────────────────── */

export function ChatListSkeleton() {
	return (
		<div className="flex flex-col">
			{Array.from({ length: 6 }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]"
					style={{ animationDelay: `${i * 60}ms` }}
				>
					<div className="h-12 w-12 rounded-full skeleton-pulse shrink-0" />
					<div className="flex-1 space-y-2">
						<div className="h-4 w-32 rounded skeleton-pulse" />
						<div className="h-3 w-48 rounded skeleton-pulse" />
					</div>
					<div className="flex flex-col items-end gap-1">
						<div className="h-2 w-12 rounded skeleton-pulse" />
						<div className="h-5 w-5 rounded-full skeleton-pulse" />
					</div>
				</div>
			))}
		</div>
	);
}

/* ── Gold Gradient Divider ────────────────────────────────────────── */

export function GoldDivider({ className }: { className?: string }) {
	return (
		<div className={cn("flex items-center gap-3 px-4 py-1", className)}>
			<div
				className="flex-1 h-px"
				style={{
					background:
						"linear-gradient(90deg, transparent, rgba(234,179,8,0.2), transparent)",
				}}
			/>
			<div className="w-1.5 h-1.5 rounded-full bg-gold/30" />
			<div
				className="flex-1 h-px"
				style={{
					background:
						"linear-gradient(90deg, transparent, rgba(234,179,8,0.2), transparent)",
				}}
			/>
		</div>
	);
}
