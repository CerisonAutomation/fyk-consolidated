import { Star, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../cn";
import { DisplayName } from "../atoms/DisplayName";
import { DistanceFormatted } from "../atoms/DistanceFormatted";
import { ProfileStatusIndicator } from "../atoms/ProfileStatusIndicator";
import { Badge } from "../atoms/Badge";
import { UserAvatar } from "../molecules/UserAvatar";

interface ProfileMiniCardProps {
  mediaHash?: string | null;
  displayName?: string | null;
  age?: number | null;
  distance?: number | null;
  unread?: number | null;
  onlineUntil?: number | null;
  isFavorite?: boolean;
  isVisiting?: boolean;
  hadRecentChat?: boolean;
  anonymous?: boolean;
  href?: string | null;
  className?: string;
  overlay?: ReactNode;
}

export function ProfileMiniCard({
  mediaHash = null,
  displayName = null,
  age = null,
  distance = null,
  unread = null,
  onlineUntil = null,
  isFavorite = false,
  isVisiting = false,
  hadRecentChat = false,
  anonymous = false,
  href = null,
  className,
  overlay,
}: ProfileMiniCardProps): ReactNode {
  const content = (
    <>
      <div className="absolute size-full bg-stone-700">
        <UserAvatar mediaHash={mediaHash} className="size-full" size="xl" />
      </div>

      {distance !== null && (
        <span className="absolute top-1 right-1.5 text-xs text-white drop-shadow">
          <DistanceFormatted distance={distance} />
        </span>
      )}

      {(isFavorite || hadRecentChat) && (
        <div className="absolute inset-s-2 top-2 z-1 flex w-1/6 flex-col items-center gap-1">
          {isFavorite && (
            <div className="flex aspect-square h-auto w-full rounded-full border border-white/10 bg-popover/40 backdrop-blur-2xl">
              <Star
                className="m-auto size-4/6 text-yellow-500"
                fill="currentColor"
                strokeWidth={0}
              />
              <span className="sr-only">Favorite</span>
            </div>
          )}
          {hadRecentChat && (
            <div className="flex aspect-square h-auto w-full rounded-full border border-white/10 bg-popover/40 backdrop-blur-2xl">
              <MessageCircle
                className="m-auto size-3/5 -translate-y-px text-sky-400"
                fill="currentColor"
              />
              <span className="sr-only">Chatted recently</span>
            </div>
          )}
        </div>
      )}

      {!anonymous && (
        <div className="z-1 flex w-full items-center gap-0.5 p-0.5">
          <Badge
            variant="outline"
            className="max-w-full min-w-0 shrink gap-0 bg-popover/20 backdrop-blur-2xl"
          >
            <ProfileStatusIndicator
              onlineUntil={onlineUntil}
              isVisiting={isVisiting}
              className="me-1"
            />
            <span
              className={cn(
                "block shrink truncate font-semibold",
                !displayName && "text-foreground/50",
              )}
            >
              <DisplayName name={displayName} />
            </span>
            {age !== null && (
              <>
                ,&nbsp;
                <span className="line-clamp-1 block max-w-full shrink-0 truncate">
                  {age}
                </span>
              </>
            )}
          </Badge>

          {unread !== null && unread > 0 && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-black/20 bg-primary text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? (
                <span className="text-[8px]">99+</span>
              ) : (
                unread
              )}
              <span className="sr-only">unread messages</span>
            </span>
          )}
        </div>
      )}

      {overlay}
    </>
  );

  const wrapperClass = cn(
    "relative flex aspect-square items-end overflow-hidden",
    className,
  );

  if (href !== null) {
    return (
      <a
        href={href}
        aria-label={anonymous ? "Profile" : undefined}
        className={wrapperClass}
      >
        {content}
      </a>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
