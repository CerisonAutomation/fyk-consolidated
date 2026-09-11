"use client";

import { useAppStore } from "@/lib/store";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur animate-in",
            t.type === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
            t.type === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-100",
            t.type === "info" && "border-gold/30 bg-gold/10 text-gold-soft"
          )}
        >
          {t.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          {t.type === "error" && <AlertCircle className="h-4 w-4 text-rose-400" />}
          {t.type === "info" && <Info className="h-4 w-4 text-gold" />}
          <span>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-1 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
