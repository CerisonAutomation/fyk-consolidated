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

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open]);

	const toggle = useCallback(() => setOpen((prev) => !prev), []);

	if (!user) {
		// Not authenticated — show sign-in link
		return (
			<Link
				to="/auth/sign-in"
				className="flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-mono uppercase tracking-wider text-amber-400/70 border border-amber-400/20 hover:border-amber-400/40 hover:text-amber-400 hover:bg-amber-400/5 transition-all duration-200 no-underline"
			>
				<User className="w-3.5 h-3.5" />
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
		<div ref={dropdownRef} className="relative">
			{/* Trigger button */}
			<button
				onClick={toggle}
				className="flex items-center gap-2 h-9 px-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-gold/30 hover:bg-gold/[0.05] transition-all duration-200"
				aria-expanded={open}
				aria-haspopup="true"
			>
				<div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-[9px] font-bold text-black shrink-0">
					{displayName.charAt(0).toUpperCase()}
				</div>
				<span className="hidden xl:inline text-[11px] text-white/70 max-w-[80px] truncate font-medium">
					{displayName}
				</span>
				<ChevronDown
					className={`w-3 h-3 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
				>
					{/* User info header */}
					<div className="px-4 py-3 border-b border-white/[0.06]">
						<div className="flex items-center gap-3">
							<div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-sm font-bold text-black shrink-0">
								{displayName.charAt(0).toUpperCase()}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-white/90 truncate">
									{displayName}
								</p>
								<div className="flex items-center gap-1">
									<Mail className="w-3 h-3 text-white/30" />
									<p className="text-[11px] text-white/40 truncate">{email}</p>
								</div>
							</div>
						</div>
					</div>

					{/* Menu items */}
					<div className="py-1.5">
						<Link
							to="/"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors no-underline"
							role="menuitem"
						>
							<User className="w-4 h-4 text-white/40" />
							<span className="flex-1">My Profile</span>
							<ChevronRight className="w-3 h-3 text-white/20" />
						</Link>
						<Link
							to="/settings"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors no-underline"
							role="menuitem"
						>
							<Settings className="w-4 h-4 text-white/40" />
							<span className="flex-1">Settings</span>
							<ChevronRight className="w-3 h-3 text-white/20" />
						</Link>
						<Link
							to="/settings/profile"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors no-underline"
							role="menuitem"
						>
							<Crown className="w-4 h-4 text-amber-400/50" />
							<span className="flex-1">Edit Profile</span>
							<ChevronRight className="w-3 h-3 text-white/20" />
						</Link>
					</div>

					{/* Divider */}
					<div className="mx-3 border-t border-white/[0.06]" />

					{/* Sign out */}
					<div className="py-1.5">
						<button
							onClick={() => {
								setOpen(false);
								signOut();
							}}
							className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
							role="menuitem"
						>
							<LogOut className="w-4 h-4" />
							<span>Sign Out</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
