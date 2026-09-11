import type { ReactNode } from "react";
import { cn } from "../cn";

interface BrokenMediaProps {
  className?: string;
  tone?: "muted" | "photo";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  aspectRatio?: string;
  label?: string;
}

const sizeClasses = {
  xs: "w-1/8",
  sm: "w-1/6",
  md: "w-1/2",
  lg: "w-3/5",
  xl: "w-3/4",
} as const;

export function BrokenMedia({
  className,
  tone = "muted",
  size = "sm",
  aspectRatio,
  label,
}: BrokenMediaProps): ReactNode {
  return (
    <div
      data-slot="broken-media"
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      className={cn(
        "flex items-center justify-center",
        tone === "muted" ? "bg-card-foreground/20" : "bg-neutral-700",
        className,
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Phosphor ImageBrokenIcon equivalent using inline SVG */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        fill={
          tone === "muted"
            ? "var(--color-neutral-600, #525252)"
            : "var(--color-stone-400, #a8a29e)"
        }
        className={cn("aspect-square h-auto", sizeClasses[size])}
      >
        <path d="M224,56H184.28L166.65,38.34A8,8,0,0,0,160.94,36H95.06a8,8,0,0,0-5.71,2.34L71.72,56H32A16,16,0,0,0,16,72V200a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V72A16,16,0,0,0,224,56ZM128,180a40,40,0,1,1,40-40A40,40,0,0,1,128,180Z" />
      </svg>
    </div>
  );
}
