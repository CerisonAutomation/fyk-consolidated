"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass, MessageCircle, Heart, PawPrint, CalendarDays, Users, Megaphone,
  Shield, Settings, Crown, Zap, Bell, Globe, Sparkles, MapPin,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ProfileUser } from "@/lib/types";
import { TIERS } from "@/lib/constants";

const MAIN = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/taps", label: "Taps", icon: Zap },
  { href: "/favorites", label: "Favorites", icon: Heart },
];

const COMMUNITY = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/shouts", label: "Shouts", icon: Megaphone },
  { href: "/meetnow", label: "Meet Now", icon: MapPin },
  { href: "/tribes", label: "Tribes", icon: Globe },
];

const YOU = [
  { href: "/king-pet", label: "King Pet", icon: PawPrint },
  { href: "/premium", label: "Premium", icon: Crown },
  { href: "/gamechangers", label: "Gamechangers", icon: Sparkles },
  { href: "/notifications", label: "Activity", icon: Bell },
  { href: "/safety", label: "Safety", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Group({ title, items, pathname }: { title: string; items: typeof MAIN; pathname: string }) {
  return (
    <div className="mb-3">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted/60">
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-gold/15 text-gold-soft" : "text-muted hover:bg-white/5 hover:text-white"
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
  const pathname = usePathname();
  const tier = TIERS[user.tier as keyof typeof TIERS];

  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface md:flex">
      <Link href="/discover" className="flex items-center gap-2 px-5 py-5">
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
          href="/premium"
          className="mx-3 mb-3 rounded-xl border border-gold/30 bg-gradient-to-br from-gold/15 to-transparent p-3 transition-colors hover:border-gold/50"
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
          href="/profile"
          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5"
        >
          <Avatar name={user.pseudo} photoUrl={user.photos?.[0]} size={38} online={user.online} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.pseudo}</p>
            <p className="truncate text-xs text-gold/80">{tier.name} member</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
