/**
 * The app frame: identity, primary navigation, and the honest state of the
 * backend.
 *
 * Before this file existed there was no navigation at all — Grid, Board, Chat,
 * Events and Settings were only reachable by typing a URL. Nav is the core loop,
 * so it lives here rather than being duplicated per page.
 *
 * `capabilities` comes from GET /api/session. A surface whose tables are missing
 * is shown as disabled with the reason, never rendered as an empty success.
 */

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
	CalendarDays,
	ChevronLeft,
	Compass,
	LogOut,
	MessageCircle,
	Settings as SettingsIcon,
	Shield,
	Zap,
} from "lucide-react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { api } from "#/lib/client";
import { cn } from "#/lib/utils";
import type { Capability, SessionResponse } from "#/server/handlers/session";
import { ToastStack } from "./ui/ToastStack";

export interface ShellApi {
	session: SessionResponse;
	refresh: () => Promise<void>;
	signOut: () => Promise<void>;
	capable: (capability: Capability) => boolean;
}

const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
	const value = useContext(ShellContext);
	if (!value) throw new Error("useShell must be used inside AppShell");
	return value;
}

type NavItem = {
	to: string;
	label: string;
	icon: typeof Compass;
	capability: Capability | null;
};

const NAV: NavItem[] = [
	{ to: "/grid", label: "Nearby", icon: Compass, capability: "discovery" },
	{ to: "/board", label: "Board", icon: Zap, capability: "board" },
	{ to: "/chat", label: "Chats", icon: MessageCircle, capability: "chat" },
	{ to: "/events", label: "Events", icon: CalendarDays, capability: "events" },
	{ to: "/settings", label: "You", icon: SettingsIcon, capability: null },
];

const DESKTOP_SECONDARY: NavItem[] = [
	{ to: "/safety", label: "Safety", icon: Shield, capability: "reports" },
	{
		to: "/notifications",
		label: "Activity",
		icon: MessageCircle,
		capability: null,
	},
];

export function AppShell({
	session,
	refresh,
	signOut,
	children,
}: {
	session: SessionResponse;
	refresh: () => Promise<void>;
	signOut: () => Promise<void>;
	children: ReactNode;
}) {
	const pathname = useLocation({ select: (location) => location.pathname });
	const unread = useUnreadBadge();
	const value = useMemo<ShellApi>(
		() => ({
			session,
			refresh,
			signOut,
			capable: (capability) => session.capabilities[capability] !== false,
		}),
		[session, refresh, signOut],
	);

	const isDetail = /^\/(chat|profile)\/[^/]+$/.test(pathname);
	const title = NAV.find((item) => pathname.startsWith(item.to))?.label ?? "";

	return (
		<ShellContext.Provider value={value}>
			<div className="flex min-h-[100svh] flex-col bg-canvas text-ink">
				<header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
					<div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
						{isDetail ? (
							<BackButton />
						) : (
							<span className="font-display text-[19px] leading-none tracking-[0.18em] text-gold">
								FYK
							</span>
						)}
						{title && !isDetail ? (
							<span className="text-[13px] font-medium text-muted">
								{title}
							</span>
						) : null}
						<div className="ml-auto flex items-center gap-1.5">
							<Link
								to="/notifications"
								className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
								aria-label="Activity"
							>
								<MessageCircle className="h-[18px] w-[18px]" />
								{unread > 0 ? (
									<span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-live px-1 text-[10px] font-bold leading-4 text-black">
										{unread > 9 ? "9+" : unread}
									</span>
								) : null}
							</Link>
							<Link
								to="/safety"
								className="hidden h-10 items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-gold/40 hover:text-ink sm:flex"
							>
								<Shield className="h-3.5 w-3.5 text-gold" />
								Safety
							</Link>
						</div>
					</div>
				</header>

				<main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:pb-10 md:pt-6">
					{children}
				</main>

				{/* Mobile: one-thumb primary nav. Desktop: a left rail so nav is never hidden. */}
				<nav
					aria-label="Primary"
					className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
				>
					<ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
						{NAV.map((item) => (
							<NavButton
								key={item.to}
								item={item}
								active={pathname.startsWith(item.to)}
								disabled={
									item.capability ? !value.capable(item.capability) : false
								}
							/>
						))}
					</ul>
				</nav>

				<nav
					aria-label="Primary"
					className="fixed left-0 top-0 z-30 hidden h-full w-[76px] flex-col items-center gap-1 border-r border-line bg-canvas py-4 md:flex lg:w-[200px] lg:items-stretch lg:px-4"
				>
					<span className="mb-4 hidden text-center font-display text-[20px] tracking-[0.18em] text-gold lg:block">
						FYK
					</span>
					<span className="mb-4 text-center font-display text-[18px] tracking-[0.18em] text-gold md:block lg:hidden">
						FYK
					</span>
					{NAV.map((item) => (
						<NavButton
							key={item.to}
							item={item}
							active={pathname.startsWith(item.to)}
							disabled={
								item.capability ? !value.capable(item.capability) : false
							}
							rail
						/>
					))}
					<div className="mt-auto flex flex-col gap-1">
						{DESKTOP_SECONDARY.map((item) => (
							<NavButton
								key={item.to}
								item={item}
								active={pathname.startsWith(item.to)}
								disabled={
									item.capability ? !value.capable(item.capability) : false
								}
								rail
							/>
						))}
						{session.role !== "user" ? (
							<NavButton
								item={{
									to: "/admin",
									label: "Moderation",
									icon: Shield,
									capability: "moderation",
								}}
								active={pathname.startsWith("/admin")}
								disabled={!value.capable("moderation")}
								rail
							/>
						) : null}
						<button
							type="button"
							onClick={() => void signOut()}
							className="flex h-11 items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
						>
							<LogOut className="h-[18px] w-[18px] shrink-0" />
							<span className="hidden lg:inline">Sign out</span>
						</button>
					</div>
				</nav>

				<div
					className="hidden md:block md:pl-[76px] lg:pl-[200px]"
					aria-hidden="true"
				/>
				<ToastStack />
			</div>
		</ShellContext.Provider>
	);
}

function NavButton({
	item,
	active,
	disabled,
	rail,
}: {
	item: NavItem;
	active: boolean;
	disabled: boolean;
	rail?: boolean;
}) {
	const Icon = item.icon;
	const label = disabled ? `${item.label} (unavailable)` : item.label;
	return (
		<li className={rail ? "w-full" : "flex-1 list-none"}>
			<Link
				to={item.to}
				aria-current={active ? "page" : undefined}
				aria-disabled={disabled || undefined}
				title={label}
				className={cn(
					"relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-[10.5px] font-medium transition-colors",
					rail
						? "h-11 justify-start px-3 text-[13.5px] lg:text-[14px]"
						: "flex-col",
					disabled
						? "text-faint"
						: active
							? "text-gold"
							: "text-muted hover:text-ink",
				)}
			>
				<span
					className={cn(
						"flex h-7 w-11 items-center justify-center rounded-full transition-colors",
						rail && "h-auto w-auto",
						active && !rail && "bg-gold/12",
						active && rail && "text-gold",
					)}
				>
					<Icon
						className={cn(rail ? "h-[18px] w-[18px]" : "h-[20px] w-[20px]")}
						aria-hidden="true"
					/>
				</span>
				<span className={rail ? "hidden lg:inline" : undefined}>
					{item.label}
				</span>
			</Link>
		</li>
	);
}

/**
 * `Back` goes back, not up: a profile opened from the Board should return to the
 * Board. `history.state.idx` is TanStack Router's own depth counter — 0 means the
 * session landed on this page directly, so there is nothing to go back to and the
 * button walks up one route instead of dead-ending.
 */
function BackButton() {
	const navigate = useNavigate();
	const canGoBack =
		typeof window !== "undefined" && (window.history.state?.idx ?? 0) > 0;
	return (
		<button
			type="button"
			onClick={() => {
				if (canGoBack) window.history.back();
				else navigate({ to: "." });
			}}
			className="-ml-2 flex h-10 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted transition-colors hover:text-ink"
		>
			<ChevronLeft className="h-5 w-5" />
			Back
		</button>
	);
}

/**
 * The badge is polled rather than pushed. Saying "live" would be a claim this
 * build cannot support; 45 s is frequent enough to be useful and cheap enough to
 * run from every open tab.
 */
function useUnreadBadge(): number {
	const [unread, setUnread] = useState(0);
	const pathname = useLocation({ select: (location) => location.pathname });

	// `pathname` is not read inside the effect: it is the reason to re-poll, so the
	// badge reflects the conversation the user just left rather than a stale one.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see the note above.
	useEffect(() => {
		let alive = true;
		const load = async () => {
			try {
				const data = await api.get<{ unread: number }>("notifications");
				if (alive) setUnread(data.unread);
			} catch {
				// A failed badge poll must never surface as an error toast.
			}
		};
		void load();
		const interval = window.setInterval(load, 45_000);
		return () => {
			alive = false;
			window.clearInterval(interval);
		};
	}, [pathname]);

	return unread;
}
