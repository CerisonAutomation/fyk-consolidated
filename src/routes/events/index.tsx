import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Calendar,
	Clock,
	MapPin,
	Search,
	X,
	List,
	LayoutGrid,
	CalendarDays,
	Share2,
	Bell,
	Heart,
	Eye,
	Sparkles,
	Check,
	Dumbbell,
	UtensilsCrossed,
	Coffee,
	Egg,
	Gamepad2,
	PawPrint,
	Leaf,
	Music,
	Palette,
	Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	MOCK_EVENTS,
	EVENT_META,
	type EventItem,
	type EventType,
	type EventTab,
} from "@/data/events";

export const Route = createFileRoute("/events/")({
	component: EventsPage,
});

/* ── Icon Lookup ─────────────────────────────────────────────────────── */
const ICON_MAP: Record<string, typeof Coffee> = {
	Dumbbell,
	UtensilsCrossed,
	Heart,
	Coffee,
	Egg,
	Gamepad2,
	PawPrint,
	Leaf,
	Music,
	Palette,
	Briefcase,
	MapPin: MapPin,
};

function getEventIcon(type: EventType) {
	const meta = EVENT_META[type] || EVENT_META.chill;
	return ICON_MAP[meta.icon] || Coffee;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function formatEventDate(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const diffDays = Math.floor(
		(d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (diffDays === 0) {
		return `Today at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
	}
	if (diffDays === 1) {
		return `Tomorrow at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
	}
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function getTimeFiltered(events: EventItem[], tf: string) {
	if (tf === "All") return events;
	const now = new Date();
	if (tf === "Today") {
		const d = now.toISOString().split("T")[0];
		return events.filter(
			(e) => new Date(e.datetime).toISOString().split("T")[0] === d,
		);
	}
	if (tf === "This Week") {
		const w = new Date(now);
		w.setDate(w.getDate() + 7);
		return events.filter((e) => {
			const dt = new Date(e.datetime);
			return dt >= now && dt <= w;
		});
	}
	if (tf === "Weekend")
		return events.filter((e) => {
			const day = new Date(e.datetime).getDay();
			return day === 0 || day === 6;
		});
	return events;
}

/* ── Pill component (inline) ─────────────────────────────────────────── */
function Pill({
	children,
	color,
}: {
	children: React.ReactNode;
	color?: string;
}) {
	return (
		<span
			className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider border"
			style={{
				color: color || "var(--color-gold)",
				background: color ? `${color}14` : "oklch(0.80 0.17 85 / 0.10)",
				borderColor: color ? `${color}30` : "oklch(0.80 0.17 85 / 0.30)",
			}}
		>
			{children}
		</span>
	);
}

/* ── Progress component ──────────────────────────────────────────────── */
function Progress({ value, max }: { value: number; max: number }) {
	const pct = Math.round((value / max) * 100);
	return (
		<div className="progress-track w-full h-1.5">
			<div
				className="progress-fill h-full"
				style={{ width: `${Math.min(pct, 100)}%` }}
			/>
		</div>
	);
}

/* ── Avatar Stack ─────────────────────────────────────────────────────── */
function AvatarStack({ count }: { count: number }) {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	return (
		<div className="flex items-center gap-1.5">
			<div className="flex -space-x-2">
				{Array.from({ length: Math.min(count, 4) }, (_, i) => (
					<div
						key={i}
						className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[8px] font-bold border-2"
						style={{
							background: `linear-gradient(135deg, ${i === 0 ? "#d4a017" : i === 1 ? "#7c3aed" : i === 2 ? "#06b6d4" : "#f43f5e"}, ${i === 0 ? "#f7b500" : i === 1 ? "#a855f7" : i === 2 ? "#22d3ee" : "#fb7185"})`,
							color: "#000",
							borderColor: "var(--color-background)",
						}}
					>
						{letters[i]}
					</div>
				))}
				{count > 4 && (
					<div className="w-[26px] h-[26px] rounded-full bg-card border border-border flex items-center justify-center">
						<span className="text-[9px] font-mono text-muted-foreground">
							+{count - 4}
						</span>
					</div>
				)}
			</div>
			<span className="text-[10px] font-mono text-muted-foreground">
				{count} going
			</span>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════
   EVENT CARD (List View)
   ═══════════════════════════════════════════════════════════════════════ */
function EventCard({
	event,
	expanded,
	onToggle,
	onRsvp,
}: {
	event: EventItem;
	expanded: boolean;
	onToggle: () => void;
	onRsvp: (id: string, status: string) => void;
}) {
	const meta = EVENT_META[event.type] || EVENT_META.chill;
	const TypeIcon = getEventIcon(event.type);
	const pct = Math.round((event.attendeeCount / event.capacity) * 100);

	return (
		<div
			className="glass-card overflow-hidden cursor-pointer interactive"
			onClick={onToggle}
		>
			{/* Colored top bar */}
			<div
				className="h-1"
				style={{
					background: `linear-gradient(90deg, ${meta.color}, transparent)`,
				}}
			/>

			<div className="p-4">
				{/* Header */}
				<div className="flex items-start gap-3 mb-2">
					<div
						className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
						style={{
							background: `linear-gradient(135deg, ${meta.color}20, ${meta.color}05)`,
						}}
					>
						<TypeIcon className="w-5 h-5" style={{ color: meta.color }} />
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-0.5 flex-wrap">
							<h3
								className="font-display text-base tracking-wide truncate"
								style={{ fontFamily: "var(--font-display)" }}
							>
								{event.title}
							</h3>
							<Pill color={meta.color}>{meta.label}</Pill>
							{event.isFree ? (
								<Pill color="#22c55e">Free</Pill>
							) : (
								<Pill color="#a855f7">Paid</Pill>
							)}
						</div>
						<p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
							<Calendar className="w-3 h-3" />
							{formatEventDate(event.datetime)}
							<span className="mx-0.5 opacity-40">&middot;</span>
							<MapPin className="w-3 h-3" />
							{event.location}
						</p>
					</div>
				</div>

				{/* Description */}
				<p
					className={cn(
						"text-xs text-muted-foreground leading-relaxed",
						!expanded && "line-clamp-2",
					)}
				>
					{event.description}
				</p>

				{/* Expanded content */}
				{expanded && (
					<div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
						{/* Host */}
						<div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border">
							<div
								className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
								style={{
									background: "linear-gradient(135deg, #d4a017, #f7b500)",
									color: "#000",
								}}
							>
								{event.hostAvatar}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-xs font-medium">{event.hostName}</p>
								<p className="text-[9px] text-muted-foreground">Host</p>
							</div>
						</div>

						<AvatarStack count={event.attendeeCount} />

						{/* Actions */}
						<div className="flex gap-2">
							<button
								type="button"
								className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-cyan hover:text-cyan transition"
							>
								<Share2 className="w-3 h-3" /> Share
							</button>
							<button
								type="button"
								className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-gold hover:text-gold transition"
							>
								<Bell className="w-3 h-3" /> Remind
							</button>
						</div>

						{/* RSVP */}
						<div onClick={(ev) => ev.stopPropagation()}>
							<RsvpButtons
								eventId={event.id}
								status={event.rsvpStatus}
								onRsvp={onRsvp}
							/>
						</div>
					</div>
				)}

				{/* Collapsed footer */}
				{!expanded && (
					<div className="mt-3 flex items-center justify-between">
						<AvatarStack count={event.attendeeCount} />
						<div className="flex items-center gap-3">
							<div className="w-24">
								<Progress value={event.attendeeCount} max={event.capacity} />
							</div>
							<span
								className="text-[9px] font-mono"
								style={{
									color: pct > 80 ? "var(--color-red)" : "var(--color-gold)",
								}}
							>
								{pct}%
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════
   RSVP BUTTONS
   ═══════════════════════════════════════════════════════════════════════ */
function RsvpButtons({
	eventId,
	status,
	onRsvp,
}: {
	eventId: string;
	status?: string;
	onRsvp: (id: string, s: string) => void;
}) {
	const going = status === "going";
	const interested = status === "interested";

	if (going) {
		return (
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => onRsvp(eventId, "cancel")}
					className="flex-1 min-h-[44px] py-2.5 rounded-lg border text-sm font-display tracking-wider flex items-center justify-center gap-1.5"
					style={{
						borderColor: "oklch(0.77 0.21 150 / 0.30)",
						color: "var(--color-neon)",
						background: "oklch(0.77 0.21 150 / 0.10)",
						fontFamily: "var(--font-display)",
					}}
				>
					<Check className="w-4 h-4" /> GOING
				</button>
				<button
					type="button"
					onClick={() => onRsvp(eventId, "cancel")}
					className="px-4 min-h-[44px] py-2.5 rounded-lg border text-sm transition"
					style={{
						borderColor: "oklch(0.64 0.26 25 / 0.30)",
						color: "var(--color-red)",
					}}
				>
					CAN'T GO
				</button>
			</div>
		);
	}

	return (
		<div className="flex gap-2">
			<button
				type="button"
				onClick={() => onRsvp(eventId, "interested")}
				className="flex-1 min-h-[44px] py-2.5 rounded-lg border text-sm font-display tracking-wider flex items-center justify-center gap-1.5 transition"
				style={{
					borderColor: interested
						? "oklch(0.77 0.16 200 / 0.30)"
						: "var(--color-border)",
					color: interested
						? "var(--color-cyan)"
						: "var(--color-muted-foreground)",
					background: interested
						? "oklch(0.77 0.16 200 / 0.10)"
						: "transparent",
					fontFamily: "var(--font-display)",
				}}
			>
				<Eye className="w-4 h-4" /> INTERESTED
			</button>
			<button
				type="button"
				onClick={() => onRsvp(eventId, "going")}
				className="flex-1 min-h-[44px] py-2.5 rounded-lg text-sm font-display tracking-wider flex items-center justify-center gap-1.5 gold-gradient transition hover:shadow-[0_0_20px_oklch(0.80_0.17_85_/_0.35)]"
				style={{ color: "#000", fontFamily: "var(--font-display)" }}
			>
				<Sparkles className="w-4 h-4" /> GOING
			</button>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════
   GRID VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function GridView({
	events,
	selectedId,
	onSelect,
	onRsvp,
}: {
	events: EventItem[];
	selectedId: string | null;
	onSelect: (id: string | null) => void;
	onRsvp: (id: string, status: string) => void;
}) {
	const selected = events.find((e) => e.id === selectedId);

	return (
		<div>
			<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
				{events.map((e) => {
					const meta = EVENT_META[e.type] || EVENT_META.chill;
					const TypeIcon = getEventIcon(e.type);
					return (
						<div
							key={e.id}
							className="glass-card overflow-hidden cursor-pointer interactive"
							onClick={() => onSelect(selectedId === e.id ? null : e.id)}
						>
							<div
								className="h-28 relative"
								style={{
									background: `linear-gradient(135deg, ${meta.color}40, ${meta.color}10, transparent)`,
								}}
							>
								<TypeIcon
									className="absolute top-3 left-3 w-6 h-6"
									style={{ color: meta.color, opacity: 0.8 }}
								/>
								<div className="absolute top-3 right-3">
									<Pill color={meta.color}>{meta.label.split(" ")[0]}</Pill>
								</div>
								<div className="absolute bottom-3 left-3">
									<Pill color={e.isFree ? "#22c55e" : "#a855f7"}>
										{e.isFree ? "Free" : "Paid"}
									</Pill>
								</div>
								{selectedId === e.id && (
									<div className="absolute inset-0 ring-2 ring-gold" />
								)}
							</div>
							<div className="p-3">
								<h3
									className="font-display text-sm tracking-wide truncate mb-1"
									style={{ fontFamily: "var(--font-display)" }}
								>
									{e.title}
								</h3>
								<p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
									<Calendar className="w-3 h-3" />
									{formatEventDate(e.datetime)}
								</p>
								<p className="text-[10px] text-muted-foreground truncate mb-2 flex items-center gap-1">
									<MapPin className="w-3 h-3" />
									{e.location}
								</p>
								<div className="mb-2">
									<Progress value={e.attendeeCount} max={e.capacity} />
								</div>
								<AvatarStack count={e.attendeeCount} />
							</div>
						</div>
					);
				})}
			</div>

			{/* Bottom sheet detail */}
			{selected && (
				<div
					className="fixed inset-0 z-[100] flex items-end"
					onClick={() => onSelect(null)}
				>
					<div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
					<div
						className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl p-5 glass-card-heavy animate-in slide-in-from-bottom duration-300"
						onClick={(ev) => ev.stopPropagation()}
					>
						<div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
						<EventCard
							event={selected}
							expanded={true}
							onToggle={() => {}}
							onRsvp={onRsvp}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════
   CALENDAR VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function CalendarView({
	events,
	onEventClick,
}: {
	events: EventItem[];
	onEventClick: (e: EventItem) => void;
}) {
	const [currentMonth, setCurrentMonth] = useState(new Date());

	const daysInMonth = useMemo(() => {
		const year = currentMonth.getFullYear();
		const month = currentMonth.getMonth();
		const firstDay = new Date(year, month, 1).getDay();
		const daysCount = new Date(year, month + 1, 0).getDate();
		const days: Array<{
			day: number;
			isCurrentMonth: boolean;
			events: EventItem[];
		}> = [];

		const prevMonthDays = new Date(year, month, 0).getDate();
		for (let i = firstDay - 1; i >= 0; i--) {
			days.push({ day: prevMonthDays - i, isCurrentMonth: false, events: [] });
		}

		for (let d = 1; d <= daysCount; d++) {
			const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
			const dayEvents = events.filter(
				(e) => new Date(e.datetime).toISOString().split("T")[0] === dateStr,
			);
			days.push({ day: d, isCurrentMonth: true, events: dayEvents });
		}

		const remaining = 42 - days.length;
		for (let d = 1; d <= remaining; d++) {
			days.push({ day: d, isCurrentMonth: false, events: [] });
		}

		return days;
	}, [currentMonth, events]);

	const monthLabel = currentMonth.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	return (
		<div className="glass-card p-4">
			{/* Month Nav */}
			<div className="flex items-center justify-between mb-3">
				<button
					type="button"
					onClick={() =>
						setCurrentMonth(
							new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
						)
					}
					className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:border-gold/30 transition"
				>
					<ChevronLeft className="w-4 h-4" />
				</button>
				<p
					className="font-display text-sm tracking-wide"
					style={{ fontFamily: "var(--font-display)" }}
				>
					{monthLabel}
				</p>
				<button
					type="button"
					onClick={() =>
						setCurrentMonth(
							new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
						)
					}
					className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:border-gold/30 transition"
				>
					<ChevronRight className="w-4 h-4" />
				</button>
			</div>

			{/* Day headers */}
			<div className="grid grid-cols-7 gap-1 mb-1">
				{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
					<div
						key={d}
						className="text-center text-[9px] font-mono text-muted-foreground uppercase py-1"
					>
						{d}
					</div>
				))}
			</div>

			{/* Calendar grid */}
			<div className="grid grid-cols-7 gap-1">
				{daysInMonth.map((cell, i) => (
					<button
						key={i}
						type="button"
						onClick={() =>
							cell.events.length > 0 && onEventClick(cell.events[0])
						}
						className={cn(
							"relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition",
							cell.isCurrentMonth
								? cell.events.length > 0
									? "text-gold cursor-pointer"
									: "text-foreground hover:bg-card"
								: "text-muted-foreground/30",
						)}
						style={
							cell.isCurrentMonth && cell.events.length > 0
								? {
										background: "oklch(0.80 0.17 85 / 0.10)",
										border: "1px solid oklch(0.80 0.17 85 / 0.20)",
									}
								: undefined
						}
					>
						{cell.day}
						{cell.events.length > 0 && (
							<div className="absolute bottom-1 flex gap-0.5">
								{cell.events.slice(0, 3).map((e, j) => {
									const meta = EVENT_META[e.type] || EVENT_META.chill;
									return (
										<div
											key={j}
											className="w-1 h-1 rounded-full"
											style={{ background: meta.color }}
										/>
									);
								})}
							</div>
						)}
					</button>
				))}
			</div>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */
function EventsPage() {
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
	const [timeFilter, setTimeFilter] = useState("All");
	const [tab, setTab] = useState<EventTab>("list");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [gridSelected, setGridSelected] = useState<string | null>(null);

	const TYPE_FILTERS: { value: EventType | "all"; label: string }[] = [
		{ value: "all", label: "All" },
		{ value: "gym", label: "Gym" },
		{ value: "dinner", label: "Dinner" },
		{ value: "chill", label: "Chill" },
		{ value: "party", label: "Party" },
		{ value: "brunch", label: "Brunch" },
		{ value: "dogwalk", label: "Dog Walk" },
		{ value: "console", label: "Console" },
		{ value: "cultural", label: "Cultural" },
		{ value: "networking", label: "Networking" },
	];

	const TIME_FILTERS = ["All", "Today", "This Week", "Weekend"];

	const filtered = useMemo(() => {
		let r = [...MOCK_EVENTS];
		if (search) {
			const q = search.toLowerCase();
			r = r.filter(
				(e) =>
					e.title.toLowerCase().includes(q) ||
					e.location.toLowerCase().includes(q),
			);
		}
		if (typeFilter !== "all") r = r.filter((e) => e.type === typeFilter);
		r = getTimeFiltered(r, timeFilter);
		r.sort(
			(a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
		);
		return r;
	}, [search, typeFilter, timeFilter]);

	const handleRsvp = (eventId: string, status: string) => {
		// In a real app this would call an API
		void eventId;
		void status;
	};

	const TABS: { key: EventTab; label: string; icon: typeof List }[] = [
		{ key: "list", label: "List", icon: List },
		{ key: "grid", label: "Grid", icon: LayoutGrid },
		{ key: "calendar", label: "Calendar", icon: CalendarDays },
	];

	return (
		<div className="max-w-2xl mx-auto px-4 py-6 pb-24">
			{/* Back + Header */}
			<div className="flex items-center justify-between gap-3 mb-4">
				<div className="flex items-center gap-3">
					<Link
						to="/"
						className="text-muted-foreground hover:text-foreground transition"
						aria-label="Back"
					>
						<ChevronLeft size={20} />
					</Link>
					<div>
						<h1
							className="text-xl tracking-wider"
							style={{ fontFamily: "var(--font-display)" }}
						>
							Events
						</h1>
						<p className="text-[10px] text-muted-foreground">
							{filtered.length} event{filtered.length !== 1 ? "s" : ""} found
						</p>
					</div>
				</div>
			</div>

			{/* Tab bar */}
			<div className="flex gap-1 bg-card rounded-xl p-1 mb-4">
				{TABS.map((t) => {
					const active = tab === t.key;
					return (
						<button
							key={t.key}
							type="button"
							onClick={() => setTab(t.key)}
							className={cn(
								"flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg tracking-wider transition-all touch-target",
								active
									? "text-gold shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
							style={{
								fontFamily: "var(--font-display)",
								fontSize: "var(--fs-xs)",
								...(active
									? {
											background: "oklch(0.80 0.17 85 / 0.10)",
										}
									: {}),
							}}
						>
							<t.icon className="w-3.5 h-3.5" />
							{t.label}
						</button>
					);
				})}
			</div>

			{/* Search */}
			<div className="relative mb-3">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search events..."
					className="w-full bg-card border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-gold transition placeholder:text-muted-foreground/50"
				/>
				{search && (
					<button
						type="button"
						onClick={() => setSearch("")}
						className="absolute right-3 top-1/2 -translate-y-1/2"
					>
						<X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
					</button>
				)}
			</div>

			{/* Type filters */}
			<div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-2">
				{TYPE_FILTERS.map((f) => {
					const meta = f.value !== "all" ? EVENT_META[f.value] : null;
					const active = typeFilter === f.value;
					return (
						<button
							key={f.value}
							type="button"
							onClick={() => setTypeFilter(f.value)}
							className="px-3 py-2 rounded-full whitespace-nowrap transition shrink-0 touch-target border"
							style={{
								fontSize: "var(--fs-xs)",
								...(meta && active
									? {
											background: `${meta.color}14`,
											borderColor: `${meta.color}50`,
											color: meta.color,
										}
									: active
										? {
												background: "oklch(0.80 0.17 85 / 0.10)",
												borderColor: "oklch(0.80 0.17 85 / 0.50)",
												color: "var(--color-gold)",
											}
										: {
												background: "var(--color-card)",
												borderColor: "var(--color-border)",
												color: "var(--color-muted-foreground)",
											}),
							}}
						>
							{meta && (
								<span
									className="inline-block w-2 h-2 rounded-full mr-1.5"
									style={{ background: meta.color }}
								/>
							)}
							{f.label}
						</button>
					);
				})}
			</div>

			{/* Time filters */}
			<div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-2">
				{TIME_FILTERS.map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTimeFilter(t)}
						className="px-3 py-2 rounded-full whitespace-nowrap transition shrink-0 flex items-center gap-1 touch-target border"
						style={{
							fontSize: "var(--fs-xs)",
							...(timeFilter === t
								? {
										background: "oklch(0.77 0.16 200 / 0.10)",
										borderColor: "oklch(0.77 0.16 200 / 0.30)",
										color: "var(--color-cyan)",
									}
								: {
										background: "var(--color-card)",
										borderColor: "var(--color-border)",
										color: "var(--color-muted-foreground)",
									}),
						}}
					>
						<Clock className="w-3 h-3" />
						{t}
					</button>
				))}
			</div>

			{/* Content */}
			{tab === "list" && (
				<div className="space-y-3">
					{filtered.length > 0 ? (
						filtered.map((e) => (
							<EventCard
								key={e.id}
								event={e}
								expanded={expandedId === e.id}
								onToggle={() =>
									setExpandedId(expandedId === e.id ? null : e.id)
								}
								onRsvp={handleRsvp}
							/>
						))
					) : (
						<div className="glass-card p-10 text-center">
							<Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-60" />
							<h3
								className="text-xl tracking-wide mb-2"
								style={{ fontFamily: "var(--font-display)" }}
							>
								No events found
							</h3>
							<p className="text-sm text-muted-foreground">
								Try adjusting your filters.
							</p>
						</div>
					)}
				</div>
			)}

			{tab === "grid" && (
				<GridView
					events={filtered}
					selectedId={gridSelected}
					onSelect={setGridSelected}
					onRsvp={handleRsvp}
				/>
			)}

			{tab === "calendar" && (
				<CalendarView
					events={filtered}
					onEventClick={(e) => setGridSelected(e.id)}
				/>
			)}
		</div>
	);
}
