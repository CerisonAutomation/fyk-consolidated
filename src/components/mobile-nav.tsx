"use client";

import { Link, useLocation } from "@tanstack/react-router";
import {
	Bell,
	Compass,
	MessageCircle,
	PawPrint,
	User,
	Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS: readonly {
	to:
		| "/discover"
		| "/interest/taps"
		| "/chat"
		| "/king-pet"
		| "/notifications"
		| "/profile";
	label: string;
	icon: typeof Compass;
}[] = [
	{ to: "/discover", label: "Discover", icon: Compass },
	{ to: "/interest/taps", label: "Taps", icon: Zap },
	{ to: "/chat", label: "Chat", icon: MessageCircle },
	{ to: "/king-pet", label: "Pet", icon: PawPrint },
	{ to: "/notifications", label: "Activity", icon: Bell },
	{ to: "/profile", label: "Me", icon: User },
];

export function MobileNav() {
	const pathname = useLocation({ select: (location) => location.pathname });

	return (
		<nav
			aria-label="Mobile navigation"
			className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
		>
			<div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
				{ITEMS.map((item) => {
					const active =
						pathname === item.to || pathname.startsWith(`${item.to}/`);
					const Icon = item.icon;
					return (
						<Link
							key={item.to}
							to={item.to}
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-medium transition-colors",
								active ? "text-gold-soft" : "text-muted",
							)}
						>
							<span
								className={cn(
									"relative flex h-7 w-11 items-center justify-center rounded-full transition-colors",
									active && "bg-gold/15",
								)}
							>
								<Icon className="h-[20px] w-[20px]" aria-hidden="true" />
							</span>
							{item.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
