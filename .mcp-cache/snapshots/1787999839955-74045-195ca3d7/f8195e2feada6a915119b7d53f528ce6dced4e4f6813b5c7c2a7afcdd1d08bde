import type { ReactNode } from "react";
import { cn } from "../cn";
import { SelectionCheck } from "./SelectionCheck";

interface SelectionOverlayProps {
  className?: string;
}

export function SelectionOverlay({
  className,
}: SelectionOverlayProps): ReactNode {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center rounded-[inherit] bg-primary/50 outline-2 -outline-offset-2 outline-primary",
        className,
      )}
    >
      <SelectionCheck />
    </div>
  );
}
