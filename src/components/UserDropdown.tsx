/**
 * UserDropdown — glass-blur dropdown menu shown in the Header
 * when the user is authenticated. Shows user info, quick links, and sign out.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
	User,
	Settings,
	Crown,
	LogOut,
	ChevronDown,
	Mail,
	ChevronRight,
} from "lucide-react";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import { signOut } from "#/domains/auth/services/sign-out";

export function UserDropdown() {
	const { user } = useSupabaseSession();
	const [open, setOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	// Close on Escape and return focus to trigger
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open]);

	// Keyboard navigation within the menu
	const handleMenuKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const menu = dropdownRef.current?.querySelector("[role=menu]");
			if (!menu) return;
			const items = Array.from(
				menu.querySelectorAll<HTMLElement>("[role=menuitem]")
			);
			const currentIndex = items.indexOf(document.activeElement as HTMLElement);

			switch (e.key) {
				case "ArrowDown": {
					e.preventDefault();
					const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
					items[next]?.focus();
					break;
				}
				case "ArrowUp": {
					e.preventDefault();
					const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
					items[prev]?.focus();
					break;
				}
				case "Home": {
					e.preventDefault();
					items[0]?.focus();
					break;
				}
				case "End": {
					e.preventDefault();
					items[items.length - 1]?.focus();
					break;
				}
			}
		},
		[]
	);

	const toggle = useCallback(() => setOpen((prev) => !prev), []);

	if (!user) {
		// Not authenticated — show sign-in link
		return (
			<Link
				to="/auth/sign-in"
				className="flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-mono uppercase tracking-wider text-primary/70 border border-primary/20 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-200 no-underline"
			>
				<User className="w-3.5 h-3.5" aria-hidden="true" />
				<span className="hidden xl:inline">Sign In</span>
			</Link>
		);
	}

	const displayName =
		(user.user_metadata as Record<string, string>)?.first_name ||
		user.email?.split("@")[0] ||
		"King";
	const email = user.email || "";

	return (
		<div ref={dropdownRef} className="relative" onKeyDown={handleMenuKeyDown}>
			{/* Trigger button */}
			<button
				ref={triggerRef}
				onClick={toggle}
				className="flex items-center gap-2 h-9 px-2 rounded-xl border border-border bg-surface hover:border-primary/30 hover:bg-primary/5 transition-colors duration-200"
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label={`User menu for ${displayName}`}
			>
				<div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0" aria-hidden="true">
					{displayName.charAt(0).toUpperCase()}
				</div>
				<span className="hidden xl:inline text-[11px] text-muted-foreground max-w-[80px] truncate font-medium">
					{displayName}
				</span>
				<ChevronDown
					className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>

			{/* Dropdown panel */}
			{open && (
				<div
					className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-[100] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
					style={{
						background: "rgba(15,15,25,0.95)",
						border: "1px solid rgba(255,255,255,0.08)",
						backdropFilter: "blur(32px)",
						boxShadow:
							"0 20px 60px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)",
					}}
					role="menu"
					aria-label={`${displayName} menu`}
				>
					{/* User info header */}
					<div className="px-4 py-3 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0" aria-hidden="true">
								{displayName.charAt(0).toUpperCase()}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-foreground truncate">
									{displayName}
								</p>
								<div className="flex items-center gap-1">
									<Mail className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
									<p className="text-[11px] text-muted-foreground truncate">{email}</p>
								</div>
							</div>
						</div>
					</div>

					{/* Menu items */}
					<div className="py-1.5">
						<Link
							to="/"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors no-underline"
							role="menuitem"
							tabIndex={-1}
						>
							<User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
							<span className="flex-1">My Profile</span>
							<ChevronRight className="w-3 h-3 text-muted-foreground/60" aria-hidden="true" />
						</Link>
						<Link
							to="/settings"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors no-underline"
							role="menuitem"
							tabIndex={-1}
						>
							<Settings className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
							<span className="flex-1">Settings</span>
							<ChevronRight className="w-3 h-3 text-muted-foreground/60" aria-hidden="true" />
						</Link>
						<Link
							to="/settings/profile"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors no-underline"
							role="menuitem"
							tabIndex={-1}
						>
							<Crown className="w-4 h-4 text-amber-400/50" aria-hidden="true" />
							<span className="flex-1">Edit Profile</span>
							<ChevronRight className="w-3 h-3 text-muted-foreground/60" aria-hidden="true" />
						</Link>
					</div>

					{/* Divider */}
					<div className="mx-3 border-t border-border" />

					{/* Sign out */}
					<div className="py-1.5">
						<button
							onClick={() => {
								setOpen(false);
								signOut();
							}}
							className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
							role="menuitem"
							tabIndex={-1}
						>
							<LogOut className="w-4 h-4" aria-hidden="true" />
							<span>Sign Out</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
