"use client";

import { Link, useRouterState } from "@tanstack/react-router";

import { Compass, MessageCircle, Zap, PawPrint, User, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/interest/taps", label: "Taps", icon: Zap },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/king-pet", label: "Pet", icon: PawPrint },
  { href: "/notifications", label: "Activity", icon: Bell },
  { href: "/profile", label: "Me", icon: User },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-medium transition-colors",
                active ? "text-gold-soft" : "text-muted"
              )}
            >
              <span
                className={cn(
                  "relative flex h-7 w-11 items-center justify-center rounded-full transition-colors",
                  active && "bg-gold/15"
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
