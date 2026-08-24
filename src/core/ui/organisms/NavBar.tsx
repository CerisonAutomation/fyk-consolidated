import { Link, useLocation } from "@tanstack/react-router";
import { Droplets, Flame, Grid3X3, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../atoms/Badge";
import { cn } from "../cn";
import { BrokenUserAvatar } from "../molecules/BrokenUserAvatar";
import { UserAvatar } from "../molecules/UserAvatar";
import { ProgressiveBlur } from "./ProgressiveBlur";

interface NavBarProps {
	/** User's profile photo media hash */
	profileMediaHash?: string | null;
	/** Whether there are unread messages */
	hasUnread?: boolean;
	/** Whether there are unseen taps/interests */
	hasUnseenTaps?: boolean;
	className?: string;
}

export function NavBar({
	profileMediaHash = null,
	hasUnread = false,
	hasUnseenTaps = false,
	className,
}: NavBarProps): ReactNode {
	const { pathname } = useLocation();

	const links = [
		{
			to: "/grid" as const,
			label: "Browse",
			icon: <Grid3X3 className="size-5" fill="currentColor" />,
			isActive: pathname === "/grid" || pathname === "/",
		},
		{
			to: "/right-now" as const,
			label: "Right Now",
			icon: <Droplets className="size-5" fill="currentColor" />,
			isActive: pathname === "/right-now",
		},
		{
			to: "/interest/taps" as const,
			label: "Interest",
			icon: <Flame className="size-5" fill="currentColor" />,
			isActive: pathname.startsWith("/interest"),
			hasBadge: hasUnseenTaps,
		},
		{
			to: "/chat" as const,
			label: "Inbox",
			icon: <MessageCircle className="size-5" fill="currentColor" />,
			isActive: pathname === "/chat",
			hasBadge: hasUnread,
		},
	];

	return (
		<ProgressiveBlur
			direction="bottomToTop"
			tag="nav"
			className={cn(
				"fixed bottom-0 z-50 w-full pt-2 pb-[env(safe-area-inset-bottom,0px)]",
				className,
			)}
			bgClass="bg-gradient-to-t from-background to-transparent"
			contentClass="overflow-auto no-scrollbar left-1/2 -translate-x-1/2 m-auto flex justify-center gap-2 px-2"
		>
			<div className="flex shrink-0 rounded-full border border-border bg-background/80 backdrop-blur-xl [&>a>svg]:size-5!">
				{links.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						data-active={link.isActive || undefined}
						className={cn(
							"relative inline-flex h-[calc(100%-1px)] flex-1 flex-col items-center justify-center gap-0.5 rounded-full border border-transparent! px-3 py-1 text-xs whitespace-nowrap text-foreground/60",
							"hover:bg-input/20 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
							"disabled:pointer-events-none disabled:opacity-50",
							"dark:text-muted-foreground dark:hover:bg-input/20",
							"data-[active]:font-medium data-[active]:text-foreground",
							"dark:data-[active]:border-input dark:data-[active]:text-accent",
							"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
						)}
					>
						{link.icon}
						{link.label}
						{link.hasBadge && (
							<Badge className="absolute inset-e-2 top-1 size-2.5 rounded-full p-0" />
						)}
					</Link>
				))}
			</div>

			<Link
				to="/settings"
				aria-label="Me"
				className={cn(
					"flex size-14 shrink-0 rounded-full border bg-muted p-1",
					pathname.includes("/settings")
						? "border-2 border-accent"
						: "border-border",
				)}
			>
				{profileMediaHash ? (
					<UserAvatar
						mediaHash={profileMediaHash}
						className="size-full [&>*]:rounded-full"
						size="lg"
					/>
				) : (
					<BrokenUserAvatar className="size-full" />
				)}
			</Link>
		</ProgressiveBlur>
	);
}
