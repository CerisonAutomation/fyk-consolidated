import type { ReactNode, SVGProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../cn";

interface SpinnerProps extends SVGProps<SVGSVGElement> {
  "aria-label"?: string;
}

export function Spinner({
  className,
  "aria-label": ariaLabel = "Loading",
  ...restProps
}: SpinnerProps): ReactNode {
  return (
    <Loader2
      role="status"
      aria-label={ariaLabel}
      aria-hidden={false}
      className={cn("size-4 animate-spin", className)}
      {...restProps}
    />
  );
}
