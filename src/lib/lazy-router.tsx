/**
 * @deprecated Use src/lib/routing instead. Kept for compatibility.
 */
export * from "./routing/bundle-optimizer";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";

export function LazyWrapper({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback ?? <LazyFallback />}>{children}</Suspense>;
}
export function LazyFallback() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    </div>
  );
}
export function createLazyRoute(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(importFn);
}
export function optimizeRouteTree(currentLines: number, targetLines = 3000) {
  const savings = currentLines - targetLines;
  return {
    currentLines,
    targetLines,
    savings,
    savingsPercent: Math.round((savings / currentLines) * 100),
    meetsTarget: currentLines <= targetLines,
    strategy: `Route tree ${currentLines} → ${targetLines} saves ${savings} lines via lazy grouping`,
  };
}
