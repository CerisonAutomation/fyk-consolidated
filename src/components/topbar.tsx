import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Crown, Search } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Avatar } from "#/components/ui/Avatar";
import { signOut } from "#/domains/auth/services/sign-out";
import { api } from "#/lib/client";
import { useAppStore } from "#/lib/store";
import type { ProfileUser } from "#/lib/types";

/**
 * Mobile/desktop top bar: brand, search hand-off to Discover, activity badge,
 * profile link and sign-out.
 *
 * Search intentionally navigates to `/discover` instead of calling a
 * `/api/discover` endpoint — that route does not exist, and a fetch against it
 * would swallow the query in a 404.
 */
export function Topbar({ user }: { user: ProfileUser }) {
	const navigate = useNavigate();
	const setUser = useAppStore((state) => state.setUser);
	const setQuery = useAppStore((state) => state.setQuery);
	const [unread, setUnread] = useState(0);
	const [q, setQ] = useState("");

	useEffect(() => {
		setUser(user);
	}, [user, setUser]);

	useEffect(() => {
		let alive = true;
		const load = () =>
			api<{ unread: number }>("/api/notifications")
				.then((r) => {
					if (alive) setUnread(r.unread);
				})
				.catch(() => {
					/* keep the last known badge count */
				});
		load();
		const timer = setInterval(load, 30_000);
		return () => {
			alive = false;
			clearInterval(timer);
		};
	}, []);

	function submitSearch(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const query = q.trim();
		if (!query) return;
		// `/api/discover` is not implemented — hand the query to the Discover
		// screen through the shared store instead of firing a request that 404s.
		setQuery(query);
		navigate({ to: "/discover" });
		setQ("");
	}

	async function logout() {
		await signOut();
	}

	return (
		<header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-md md:px-8">
			<Link to="/discover" className="flex items-center gap-2 md:hidden">
				<Crown className="h-5 w-5 text-gold" />
				<span className="text-gradient-gold font-bold">FYK</span>
			</Link>

			<form
				onSubmit={submitSearch}
				className="relative hidden flex-1 md:block md:max-w-md"
				role="search"
			>
				<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
				<input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="Search kings, tribes, interests…"
					aria-label="Search kings"
					className="w-full rounded-full border border-line bg-surface-2 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-gold/50 focus:outline-none"
				/>
			</form>

			<div className="ml-auto flex items-center gap-1.5">
				<Link
					to="/notifications"
					className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-white"
					aria-label={
						unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
					}
				>
					<Bell className="h-[18px] w-[18px]" />
					{unread > 0 && (
						<span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-ink">
							{unread > 9 ? "9+" : unread}
						</span>
					)}
				</Link>
				<Link
					to="/profile"
					className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-hover"
				>
					<Avatar
						name={user.pseudo}
						photoUrl={user.photos?.[0]}
						size={32}
						online={user.online}
					/>
					<span className="hidden text-sm font-medium text-foreground sm:inline">
						{user.pseudo}
					</span>
				</Link>
				<button
					type="button"
					onClick={logout}
					className="rounded-lg px-2 py-1.5 text-[11px] text-muted transition-colors hover:bg-surface-hover hover:text-rose-300"
				>
					Sign out
				</button>
			</div>
		</header>
	);
}
