import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Crown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { MapSearchBar } from "#/components/map/MapSearchBar";
import { UserDropdown } from "#/components/UserDropdown";
import { api } from "#/lib/client";
import { cn, timeAgo } from "#/lib/utils";

/**
 * Glass header bar: brand, search hand-off, notification bell, profile actions.
 *
 * The notification shape below is the *actual* `GET /api/notifications`
 * contract (`src/routes/api/notifications/index.ts`). The previous interface
 * asked for `icon`/`text`/`time` fields that the endpoint has never returned, so
 * every row rendered an empty body, "undefined ago", and no icon.
 */
type Notification = {
	id: string;
	type: string;
	title: string;
	body?: string;
	href?: string;
	read: boolean;
	created_at: string;
};

const ICONS: Record<string, string> = {
	match: "👑",
	tap: "⚡",
	like: "❤️",
	message: "💬",
	view: "👁",
	event: "📅",
	ai: "✨",
	pet: "🐾",
	meetnow: "📍",
	system: "🔔",
};

export default function Header() {
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: notifications } = useQuery({
		queryKey: ["notifications"],
		queryFn: () =>
			api<{ notifications: Notification[] }>("/api/notifications").then(
				(r) => r.notifications,
			),
		refetchInterval: 30_000,
	});

	const markAllRead = useMutation({
		mutationFn: () =>
			api("/api/notifications", {
				method: "POST",
				body: { action: "markAllRead" },
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

	useEffect(() => {
		if (!notificationsOpen) return;
		function handleClickOutside(event: MouseEvent) {
			if (!(event.target as Element | null)?.closest("[data-notifications]")) {
				setNotificationsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [notificationsOpen]);

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-surface-nav/85 backdrop-blur-2xl">
			<nav
				aria-label="Main"
				className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6"
			>
				{/* Logo / Brand */}
				<Link
					to="/"
					className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground no-underline transition-opacity hover:opacity-80"
				>
					<span className="inline-flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-yellow-400 to-amber-600 text-[10px] font-bold text-black">
						FK
					</span>
					<span className="hidden font-[family-name:var(--font-bebas-neue)] text-lg tracking-wider sm:inline">
						FYK
					</span>
				</Link>

				{/* Search — name/interest + location autocomplete */}
				<div className="hidden flex-1 justify-center lg:flex">
					<div className="relative w-full max-w-md">
						<MapSearchBar
							placeholder="Search by name, interest, or place..."
							onSelect={() => {
								// There is no `/explore` route, no city search endpoint, and
								// `/discover` ignores history state (no `validateSearch`), so
								// a raw `state: { city }` is both untyped and unread. Send
								// the user to Discover; the map keeps the selected place.
								void navigate({ to: "/discover" });
							}}
							className="w-full"
						/>
					</div>
				</div>

				{/* Right-side actions */}
				<div className="flex items-center gap-2">
					<Link
						to="/discover"
						aria-label="Search"
						className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
					>
						<Search className="size-[18px]" aria-hidden="true" />
					</Link>

					{/* Notifications */}
					<div className="relative" data-notifications>
						<button
							type="button"
							onClick={() => setNotificationsOpen((open) => !open)}
							aria-label={
								unreadCount > 0
									? `Notifications, ${unreadCount} unread`
									: "Notifications"
							}
							aria-expanded={notificationsOpen}
							aria-haspopup="true"
							className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
						>
							<Bell className="size-[18px]" aria-hidden="true" />
							{unreadCount > 0 && (
								<span
									aria-hidden="true"
									className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background"
								/>
							)}
						</button>

						{notificationsOpen && (
							<>
								<button
									type="button"
									aria-label="Close notifications"
									className="fixed inset-0 z-40 cursor-default"
									onClick={() => setNotificationsOpen(false)}
								/>
								<div
									role="menu"
									aria-label="Notifications"
									className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
								>
									<div className="flex items-center justify-between border-b border-border px-4 py-3">
										<span
											id="notifications-label"
											className="text-sm font-semibold text-popover-foreground"
										>
											Notifications
										</span>
										<button
											type="button"
											disabled={markAllRead.isPending || unreadCount === 0}
											onClick={() => markAllRead.mutate()}
											className="text-xs font-semibold text-yellow-400 hover:underline disabled:opacity-40"
										>
											{markAllRead.isPending ? "Marking…" : "Mark all read"}
										</button>
									</div>
									<div className="max-h-80 overflow-y-auto">
										{notifications?.map((notification) => (
											<button
												type="button"
												key={notification.id}
												onClick={() =>
													queryClient.setQueryData(
														["notifications"],
														(current: Notification[] | undefined) =>
															current?.map((item) =>
																item.id === notification.id
																	? { ...item, read: true }
																	: item,
															),
													)
												}
												className={cn(
													"flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover",
													!notification.read && "bg-surface-hover",
												)}
											>
												<span
													aria-hidden="true"
													className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm"
												>
													{ICONS[notification.type] ?? ICONS.system}
												</span>
												<span className="min-w-0 flex-1">
													<span className="block text-sm text-popover-foreground">
														{notification.title}
													</span>
													{notification.body ? (
														<span className="mt-0.5 block truncate text-xs text-muted-foreground">
															{notification.body}
														</span>
													) : null}
													<span className="mt-0.5 block text-xs text-muted-foreground">
														{timeAgo(notification.created_at)}
													</span>
												</span>
												{!notification.read && (
													<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
												)}
											</button>
										))}
										{(!notifications || notifications.length === 0) && (
											<div className="px-4 py-8 text-center text-sm text-muted-foreground">
												No notifications yet
											</div>
										)}
									</div>
								</div>
							</>
						)}
					</div>

					<Link
						to="/premium"
						aria-label="Premium"
						className="flex size-9 items-center justify-center rounded-xl text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
					>
						<Crown className="size-[18px]" aria-hidden="true" />
					</Link>

					<UserDropdown />
				</div>
			</nav>
		</header>
	);
}
