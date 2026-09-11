import { useState } from "react";
import {
  ArrowLeft,
  BookMarked,
  Calendar,
  CloudOff,
  Command,
  Compass,
  Heart,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  User,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useStore, type ViewId } from "@/lib/store";
import { Avatar } from "./ui";
import { CrownMark, LogoStacked } from "./Brand";
import { useAuth } from "./EntryShell";

const NAV: { id: ViewId; label: string; icon: typeof MapPin }[] = [
  { id: "nearby", label: "Nearby", icon: MapPin },
  { id: "board", label: "Board", icon: Zap },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "events", label: "Events", icon: Calendar },
  { id: "profile", label: "Profile", icon: User },
];

const MOBILE_NAV = NAV.filter((n) => ["nearby", "board", "chats", "events", "profile"].includes(n.id));

const SECONDARY: { id: ViewId; label: string; icon: typeof MapPin }[] = [
  { id: "explore", label: "Explore cities", icon: Compass },
  { id: "guide", label: "City guide", icon: BookMarked },
  { id: "likes", label: "Likes & visits", icon: Heart },
  { id: "safety", label: "Safety centre", icon: Shield },
  { id: "settings", label: "Settings", icon: Settings },
];

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="FYK — Find Your King, go to Nearby"
      className="press group mx-auto block w-full px-5 pb-6 pt-6"
    >
      <LogoStacked className="w-full transition-transform duration-300 group-hover:-translate-y-0.5" />
    </button>
  );
}

function NavList({ vertical = true }: { vertical?: boolean }) {
  const { view, go, threads, likesReceived } = useStore();
  const unread = threads.reduce((n, t) => n + (t.unread > 0 ? 1 : 0), 0);
  const badge = (id: ViewId) => (id === "chats" ? unread : id === "likes" ? likesReceived.length : 0);

  return (
    <nav aria-label="Primary" className={cn(vertical ? "flex flex-col gap-1 px-2" : "flex")}>
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "press group relative flex items-center gap-3 rounded-xl py-[11px] pl-4 pr-3 text-[15px] font-medium",
              active ? "text-gold" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {active && (
              <>
                <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-gold" aria-hidden="true" />
                <span
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-gold-ghost to-transparent"
                  aria-hidden="true"
                />
              </>
            )}
            <Icon
              className={cn(
                "relative h-[19px] w-[19px] shrink-0 transition-transform duration-200",
                !active && "group-hover:scale-110",
              )}
              strokeWidth={active ? 2.1 : 1.8}
            />
            <span className="relative">{label}</span>
            {badge(id) > 0 && (
              <span
                className={cn(
                  "relative ml-auto grid h-[19px] min-w-[19px] place-items-center rounded-full px-1.5 text-[11px] font-bold",
                  id === "likes" ? "bg-violet text-white" : "bg-gold text-black",
                )}
              >
                {badge(id)}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function AccountPanel() {
  const { profile, user, signOut } = useAuth();
  const name = profile.display_name || profile.handle || user.email || "Your account";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="m-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2.5">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-line" />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-[13px] font-bold text-black">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
          <p className="truncate text-[11.5px] text-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
          className="press grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-live"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 border-t border-line-soft pt-2 text-[11px] font-medium text-online">Supabase session active</p>
    </div>
  );
}

function SecondaryNav() {
  const { view, go } = useStore();
  return (
    <div className="border-t border-line-soft px-2 pt-3">
      <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">Discover & account</p>
      {SECONDARY.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => go(id)}
          aria-current={view === id ? "page" : undefined}
          className={cn(
            "press flex w-full items-center gap-3 rounded-xl py-2.5 pl-4 pr-3 text-[14px] font-medium",
            view === id ? "bg-surface-2 text-gold" : "text-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  );
}

function SystemRow() {
  const { theme, toggleTheme, voiceOn, setVoiceOn, setPaletteOpen } = useStore();
  return (
    <div className="mx-3 mb-1 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title="Toggle theme"
        className="press grid h-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
      >
        {theme === "dark" ? <Moon className="h-[17px] w-[17px]" /> : <Sun className="h-[17px] w-[17px]" />}
      </button>
      <button
        type="button"
        onClick={() => setVoiceOn(!voiceOn)}
        aria-label="Toggle voice control"
        aria-pressed={voiceOn}
        title="Voice control"
        className={cn(
          "press grid h-9 place-items-center rounded-lg",
          voiceOn ? "bg-gold-ghost text-gold" : "text-muted hover:bg-surface-2 hover:text-ink",
        )}
      >
        {voiceOn ? <Mic className="h-[17px] w-[17px]" /> : <MicOff className="h-[17px] w-[17px]" />}
      </button>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Command palette"
        title="Command palette (⌘K)"
        className="press grid h-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
      >
        <Command className="h-[17px] w-[17px]" />
      </button>
    </div>
  );
}

export function Sidebar() {
  const { navOpen, setNavOpen, go } = useStore();
  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[200px] flex-col border-r border-line bg-rail lg:flex">
        <Logo onClick={() => go("nearby")} />
        <NavList />
        <div className="mt-auto">
          <SecondaryNav />
          <SystemRow />
          <AccountPanel />
        </div>
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <div className="anim-fade absolute inset-0 bg-black/70" onClick={() => setNavOpen(false)} />
          <div className="anim-sheet absolute inset-y-0 left-0 flex w-[248px] flex-col border-r border-line bg-rail">
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
              className="press absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
            <Logo onClick={() => go("nearby")} />
            <NavList />
            <div className="mt-auto">
              <SecondaryNav />
              <SystemRow />
              <AccountPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MobileNav() {
  const { view, go, threads } = useStore();
  const unread = threads.reduce((n, t) => n + (t.unread > 0 ? 1 : 0), 0);
  return (
    <nav
      aria-label="Primary"
      className="safe-b fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-rail/95 backdrop-blur-xl lg:hidden"
    >
      {MOBILE_NAV.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "press relative flex min-h-[58px] flex-col items-center justify-center gap-1 pt-1.5 text-[11px] font-semibold tracking-wide",
              active ? "text-gold" : "text-muted",
            )}
          >
            {active && <span className="absolute inset-x-6 top-0 h-[2px] rounded-full bg-gold" />}
            <span className="relative">
              <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.2 : 1.8} />
              {id === "chats" && unread > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-black">
                  {unread}
                </span>
              )}
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function TopBar({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const { query, setQuery, setNavOpen, go, view, online, queued, setPaletteOpen } = useStore();
  const { profile, user } = useAuth();
  const [focused, setFocused] = useState(false);
  const name = profile.display_name || profile.handle || user.email || "Your account";
  const initial = name.charAt(0).toUpperCase();
  const searchEnabled = ["nearby", "explore", "board", "events", "likes", "guide"].includes(view);

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-line-soft bg-canvas/85 px-4 backdrop-blur-xl md:px-6">
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        aria-label="Open menu"
        className="press flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-ink lg:hidden"
      >
        <Menu className="h-[17px] w-[17px]" />
        <CrownMark className="h-[13px] w-[14px]" />
      </button>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft className="h-[19px] w-[19px]" />
        </button>
      )}

      {title && (
        <h1 className="hidden shrink-0 text-[22px] font-semibold tracking-[-0.01em] text-ink md:block">
          {title}
        </h1>
      )}

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2.5 md:gap-3">
        {searchEnabled && (
          <div
            className={cn(
              "relative flex h-[42px] min-w-0 max-w-[380px] flex-1 items-center rounded-full border bg-surface transition-colors",
              focused ? "border-gold/60 shadow-[var(--glow-gold)]" : "border-line",
            )}
          >
            <Search className="pointer-events-none absolute left-3.5 h-[17px] w-[17px] text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              type="search"
              aria-label="Search this section"
              placeholder="Search this section..."
              className="h-full w-full rounded-full bg-transparent pl-11 pr-4 text-[14px] outline-none"
            />
          </div>
        )}

        {right}

        {!online && (
          <span
            role="status"
            className="hidden items-center gap-1.5 rounded-full border border-live/40 bg-live/12 px-3 py-1.5 text-[12px] font-semibold text-live sm:inline-flex"
          >
            <CloudOff className="h-3.5 w-3.5" />
            Offline{queued > 0 ? ` · ${queued} queued` : ""}
          </span>
        )}

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          className="press hidden h-[42px] items-center gap-2 rounded-full border border-line bg-surface px-3 text-[12.5px] font-semibold text-muted hover:border-gold/40 hover:text-gold xl:inline-flex"
        >
          <Command className="h-[15px] w-[15px]" />
          <kbd className="font-sans">⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={() => go("profile")}
          aria-label="Your profile"
          className={cn(
            "press grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-full",
            view === "profile" ? "ring-2 ring-gold ring-offset-2 ring-offset-canvas" : "ring-1 ring-line",
          )}
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              width={38}
              height={38}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center bg-gold text-[13px] font-bold text-black">{initial}</span>
          )}
        </button>
      </div>
    </header>
  );
}

export { Avatar };
