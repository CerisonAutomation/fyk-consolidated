import { X } from "lucide-react";
import { cn } from "@/utils/cn";

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: number; title: string; body?: string; tone?: "gold" | "violet" | "live" }[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-24 left-1/2 z-[120] flex w-[min(94vw,26rem)] -translate-x-1/2 flex-col gap-2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="anim-sheet pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-[var(--shadow-pop)] backdrop-blur"
        >
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
              t.tone === "violet" ? "bg-violet" : t.tone === "live" ? "bg-live" : "bg-gold",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
            {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t.body}</p>}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="press -mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
