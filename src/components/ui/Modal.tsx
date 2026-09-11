import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "anim-sheet relative max-h-[92svh] w-full overflow-y-auto scroll-thin rounded-t-3xl border border-line bg-surface shadow-[var(--shadow-pop)] sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-black/45 text-white backdrop-blur hover:bg-black/65"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
        {children}
      </div>
    </div>
  );
}
