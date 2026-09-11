"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Crown, Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { api, clearSessionToken } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { ProfileUser } from "@/lib/types";

export function Topbar({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProfileUser[]>([]);

  // Cache candidates so we only fetch once per search session
  const candidatesRef = useRef<ProfileUser[]>([]);

  useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ unread: number }>("/api/notifications")
        .then((r) => alive && setUnread(r.unread))
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Fetch candidates once when the search opens
  const fetchCandidates = useCallback(async () => {
    if (candidatesRef.current.length > 0) return;
    try {
      const r = await api<{ candidates: ProfileUser[] }>("/api/discover");
      candidatesRef.current = r.candidates;
    } catch { /* noop */ }
  }, []);

  // Filter cached candidates locally on every keystroke (no fetch)
  useEffect(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) { setResults([]); return; }

    const filtered = candidatesRef.current
      .filter(
        (c) =>
          c.pseudo.toLowerCase().includes(needle) ||
          c.tribes.some((x) => x.toLowerCase().includes(needle)) ||
          c.interests.some((x) => x.toLowerCase().includes(needle)) ||
          (c.geo?.city ?? "").toLowerCase().includes(needle)
      )
      .slice(0, 6);
    setResults(filtered);
  }, [q]);

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    clearSessionToken();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-md md:px-8">
      <Link href="/discover" className="flex items-center gap-2 md:hidden">
        <Crown className="h-5 w-5 text-gold" />
        <span className="text-gradient-gold font-bold">FYK</span>
      </Link>

      {/* search */}
      <div className="relative hidden flex-1 md:block md:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); fetchCandidates(); }}
          placeholder="Search kings, tribes, interests…"
          className="w-full rounded-full border border-line bg-surface-2 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-gold/50 focus:outline-none"
        />
        {open && q.trim() && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
              {results.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted">No kings match "{q}"</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { router.push(`/profile/${r.id}`); setOpen(false); setQ(""); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-hover"
                  >
                    <Avatar name={r.pseudo} photoUrl={r.photos?.[0]} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{r.pseudo}</p>
                      <p className="truncate text-[11px] text-muted">
                        {r.age ?? "—"} · {r.tribes.join(", ") || r.geo?.city}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-ink">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-hover"
        >
          <Avatar name={user.pseudo} photoUrl={user.photos?.[0]} size={32} online={user.online} />
          <span className="hidden text-sm font-medium text-foreground sm:inline">{user.pseudo}</span>
        </Link>
        <button
          onClick={logout}
          className="rounded-lg px-2 py-1.5 text-[11px] text-muted transition-colors hover:bg-surface-hover hover:text-rose-300"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
