import { type ReactNode } from "react";
import { cn } from "#/utils/cn";

export function Chip({
  active,
  children,
  onClick,
  tone = "gold",
  className,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  tone?: "gold" | "live" | "violet";
  className?: string;
  title?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        "press inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-medium",
        active
          ? tone === "live"
            ? "border-live/60 bg-live/12 text-live"
            : tone === "violet"
              ? "border-violet/60 bg-violet-ghost text-violet"
              : "border-gold/60 bg-gold-ghost text-gold"
          : "border-line bg-surface text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {children}
    </Comp>
  );
}
