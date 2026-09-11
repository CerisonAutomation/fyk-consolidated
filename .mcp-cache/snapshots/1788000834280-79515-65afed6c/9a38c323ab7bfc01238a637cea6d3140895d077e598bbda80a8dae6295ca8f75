import type { ReactNode } from "react";
import { cn } from "../cn";

export const TapType = {
  Friendly: "friendly",
  Hot: "hot",
  Looking: "looking",
} as const;

export type TapType = (typeof TapType)[keyof typeof TapType];

export const tapTypes: Record<TapType, string> = {
  [TapType.Friendly]: "Friendly",
  [TapType.Hot]: "Hot",
  [TapType.Looking]: "Looking",
};

interface TapIconProps {
  tapType: TapType;
  className?: string;
}

export function TapIcon({ tapType, className }: TapIconProps): ReactNode {
  const emojis: Record<TapType, string> = {
    [TapType.Friendly]: "/emojis/cookie/72px.png",
    [TapType.Hot]: "/emojis/fire/72px.png",
    [TapType.Looking]: "/emojis/demon/72px.png",
  };

  return (
    <img
      src={emojis[tapType]}
      alt={`${tapTypes[tapType]} tap`}
      width={24}
      height={24}
      className={cn("shrink-0", className)}
      draggable={false}
    />
  );
}
