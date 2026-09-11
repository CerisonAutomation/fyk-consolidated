// Next.js compatibility shim for TanStack Router
// Maps next/navigation hooks to TanStack Router equivalents
import { useNavigate, useLocation } from "@tanstack/react-router";

export function useRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  return {
    push: (url: string) => navigate({ to: url }),
    replace: (url: string) => navigate({ to: url, replace: true }),
    refresh: () => window.location.reload(),
    back: () => window.history.back(),
    pathname: location.pathname,
    query: Object.fromEntries(new URLSearchParams(location.searchStr ?? "")),
  };
}

export function useSearchParams() {
  const location = useLocation();
  const params = Object.fromEntries(new URLSearchParams(location.searchStr ?? ""));
  return [params, (_newParams: Record<string, string>) => {}] as const;
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}
