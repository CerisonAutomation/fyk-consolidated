import { Link, useLocation } from "@tanstack/react-router";
import {
	Bell,
	CalendarDays,
	Compass,
	Crown,
	Globe,
	MapPin,
	Megaphone,
	MessageCircle,
	PawPrint,
	Settings,
	Shield,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";
import { Avatar } from "#/components/ui/Avatar";
import { TIERS } from "#/lib/constants";
import type { ProfileUser } from "#/lib/types";
import { cn } from "#/lib/utils";

/**
 * Desktop sidebar. `to` values are TanStack Router paths — every entry must
 * match a real file in `src/routes/`, because `<Link>` type-checks them.
 */
const MAIN = [
	{ to: "/discover", label: "Discover", icon: Compass },
	{ to: "/chat", label: "Messages", icon: MessageCircle },
	{ to: "/interest/taps", label: "Taps", icon: Zap },
] as const;

const COMMUNITY = [
	{ to: "/events", label: "Events", icon: CalendarDays },
	{ to: "/groups", label: "Groups", icon: Users },
	{ to: "/shouts", label: "Shouts", icon: Megaphone },
	{ to: "/meetnow", label: "Meet Now", icon: MapPin },
	{ to: "/tribes", label: "Tribes", icon: Globe },
] as const;

const YOU = [
	{ to: "/king-pet", label: "King Pet", icon: PawPrint },
	{ to: "/premium", label: "Premium", icon: Crown },
	{ to: "/gamechangers", label: "Gamechangers", icon: Sparkles },
	{ to: "/notifications", label: "Activity", icon: Bell },
	{ to: "/safety", label: "Safety", icon: Shield },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

type NavItem =
	| (typeof MAIN)[number]
	| (typeof COMMUNITY)[number]
	| (typeof YOU)[number];

function Group({
	title,
	items,
	pathname,
}: {
	title: string;
	items: readonly NavItem[];
	pathname: string;
}) {
	return (
		<div className="mb-3">
			<p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
				{title}
			</p>
			<nav className="space-y-0.5">
				{items.map((item) => {
					const active =
						pathname === item.to || pathname.startsWith(`${item.to}/`);
					const Icon = item.icon;
					return (
						<Link
							key={item.to}
							to={item.to}
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
								active
									? "bg-gold/15 text-gold-soft"
									: "text-muted hover:bg-surface-hover hover:text-foreground",
							)}
						>
							<Icon className="h-[17px] w-[17px]" />
							{item.label}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}

export function Sidebar({ user }: { user: ProfileUser }) {
	const pathname = useLocation({ select: (location) => location.pathname });
	// `user.tier` is user data: an unknown tier must not crash the whole shell.
	const tier = TIERS[user.tier as keyof typeof TIERS] ?? TIERS.free;

	return (
		<aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface md:flex">
			<Link to="/" className="flex items-center gap-2 px-5 py-5">
				<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15">
					<Crown className="h-5 w-5 text-gold" />
				</div>
				<div>
					<span className="block text-lg font-bold leading-none tracking-tight text-gradient-gold">
						FYK
					</span>
					<span className="text-[10px] text-muted">Find Your King</span>
				</div>
			</Link>

			<div className="flex-1 px-3 pb-2">
				<Group title="Discover" items={MAIN} pathname={pathname} />
				<Group title="Community" items={COMMUNITY} pathname={pathname} />
				<Group title="You" items={YOU} pathname={pathname} />
			</div>

			{user.tier === "free" && (
				<Link
					to="/premium"
					className="mx-3 mb-3 block rounded-xl border border-gold/30 bg-gradient-to-br from-gold/15 to-transparent p-3 transition-colors hover:border-gold/50"
				>
					<p className="flex items-center gap-1.5 text-xs font-semibold text-gold-soft">
						<Crown className="h-3.5 w-3.5" /> Go Premium
					</p>
					<p className="mt-0.5 text-[11px] text-muted">
						Unlimited taps, 48 AI features, incognito
					</p>
				</Link>
			)}

			<div className="border-t border-line p-3">
				<Link
					to="/profile"
					className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-hover"
				>
					<Avatar
						name={user.pseudo}
						photoUrl={user.photos?.[0]}
						size={38}
						online={user.online}
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-semibold text-foreground">
							{user.pseudo}
						</p>
						<p className="truncate text-xs text-gold/80">{tier.name} member</p>
					</div>
				</Link>
			</div>
		</aside>
	);
}
