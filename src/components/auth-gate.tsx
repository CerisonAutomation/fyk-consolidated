"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { ProfileUser } from "@/lib/types";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { Topbar } from "@/components/topbar";

export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const [checked, setChecked] = useState(false);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["bootstrap"],
		queryFn: () => api<{ user: ProfileUser }>("/api/auth/me"),
		retry: false,
		staleTime: Infinity,
	});

  useEffect(() => {
    if (isLoading) return;
    if (data?.user) {
      setUser(data.user);
      setChecked(true);
    } else if (isError || !data?.user) {
      // No cookie and no bearer token → back to sign-in.
      navigate({ to: "/auth/sign-in" });
    }
  }, [isLoading, data, isError, navigate, setUser]);

  if (!checked || isLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-ink">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 animate-float">
          <Crown className="h-7 w-7 text-gold" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Signing you in…
        </div>
      </div>
    );
  }

  const user = data!.user;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-8 md:pb-8">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
