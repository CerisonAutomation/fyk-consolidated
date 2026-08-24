import type { ReactNode, ElementType, HTMLAttributes } from "react";
import { cn } from "../cn";

const BLUR_CONFIG = [
  { blur: 1, gradient: [0, 10, 30, 40] },
  { blur: 2, gradient: [10, 20, 40, 50] },
  { blur: 4, gradient: [15, 30, 50, 60] },
  { blur: 8, gradient: [20, 40, 60, 70] },
  { blur: 12, gradient: [30, 50, 70, 80] },
  { blur: 16, gradient: [40, 60, 80, 90] },
  { blur: 24, gradient: [50, 70, 90, 100] },
  { blur: 32, gradient: [60, 80] },
  { blur: 64, gradient: [70, 100] },
];

interface ProgressiveBlurProps extends HTMLAttributes<HTMLElement> {
  bgClass?: string;
  contentClass?: string;
  children?: ReactNode;
  direction: "topToBottom" | "bottomToTop";
  tag?: ElementType;
}

export function ProgressiveBlur({
  className,
  bgClass,
  contentClass,
  children,
  direction,
  tag: Tag = "div",
  ...rest
}: ProgressiveBlurProps): ReactNode {
  return (
    <Tag className={className} {...rest}>
      <div className={cn("absolute top-0 left-0 z-11 size-full", bgClass)} />
      {BLUR_CONFIG.map((config, index) => {
        const isLast = index === BLUR_CONFIG.length - 1;
        const gradientDir =
          direction === "bottomToTop" ? "to bottom" : "to top";
        const hasFourStops = config.gradient.length === 4;

        const maskValue = `linear-gradient(
          ${gradientDir},
          rgba(0, 0, 0, 0) ${config.gradient[0]}%,
          rgba(0, 0, 0, 1) ${config.gradient[1]}%${
            hasFourStops
              ? `,
          rgba(0, 0, 0, 1) ${config.gradient[2]}%,
          rgba(0, 0, 0, 0) ${config.gradient[3]}%
        `
              : ""
          }
        )`;

        return (
          <div
            key={config.blur}
            className={cn(
              "absolute top-0 left-0 size-full",
              isLast && "z-10",
            )}
            style={{
              mask: maskValue,
              WebkitMask: maskValue,
              backdropFilter: `blur(${config.blur}px)`,
              ["--pblur" as string]: `${config.blur}px`,
            }}
          />
        );
      })}
      <div className={cn("relative z-12", contentClass)}>{children}</div>
    </Tag>
  );
}
