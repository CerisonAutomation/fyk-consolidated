import type { ReactNode } from "react";
import { Grid3X3, Droplets, Flame, MessageCircle } from "lucide-react";
import { cn } from "../cn";
import { Badge } from "../atoms/Badge";
import { UserAvatar } from "../molecules/UserAvatar";
import { BrokenUserAvatar } from "../molecules/BrokenUserAvatar";
import { ProgressiveBlur } from "./ProgressiveBlur";

interface NavBarLink {
  href: string;
  label: string;
  icon: ReactNode;
  isActive: boolean;
  hasBadge?: boolean;
}

interface NavBarProps {
  /** Current route path for active state */
  currentPath?: string;
  /** User's profile photo media hash */
  profileMediaHash?: string | null;
  /** Whether there are unread messages */
  hasUnread?: boolean;
  /** Whether there are unseen taps/interests */
  hasUnseenTaps?: boolean;
  /** Navigation handler */
  onNavigate?: (href: string) => void;
  className?: string;
}

export function NavBar({
  currentPath = "/",
  profileMediaHash = null,
  hasUnread = false,
  hasUnseenTaps = false,
  onNavigate,
  className,
}: NavBarProps): ReactNode {
  const links: NavBarLink[] = [
    {
      href: "/",
      label: "Browse",
      icon: <Grid3X3 className="size-5" fill="currentColor" />,
      isActive: currentPath === "/",
    },
    {
      href: "/right-now",
      label: "Right Now",
      icon: <Droplets className="size-5" fill="currentColor" />,
      isActive: currentPath === "/right-now",
    },
    {
      href: "/interest",
      label: "Interest",
      icon: <Flame className="size-5" fill="currentColor" />,
      isActive: currentPath.startsWith("/interest"),
      hasBadge: hasUnseenTaps,
    },
    {
      href: "/chat",
      label: "Inbox",
      icon: <MessageCircle className="size-5" fill="currentColor" />,
      isActive: currentPath === "/chat",
      hasBadge: hasUnread,
    },
  ];

  return (
    <ProgressiveBlur
      direction="bottomToTop"
      tag="nav"
      className={cn(
        "fixed bottom-0 z-50 w-full pt-2 pb-[env(safe-area-inset-bottom,0px)]",
        className,
      )}
      bgClass="bg-gradient-to-t from-background to-transparent"
      contentClass="overflow-auto no-scrollbar left-1/2 -translate-x-1/2 m-auto flex justify-center gap-2 px-2"
    >
      <div className="flex shrink-0 rounded-full border border-border bg-background/80 backdrop-blur-xl [&>a>svg]:size-5!">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            data-active={link.isActive || undefined}
            onClick={(e) => {
              if (link.isActive) {
                e.preventDefault();
                return;
              }
              if (onNavigate) {
                e.preventDefault();
                onNavigate(link.href);
              }
            }}
            className={cn(
              "relative inline-flex h-[calc(100%-1px)] flex-1 flex-col items-center justify-center gap-0.5 rounded-full border border-transparent! px-3 py-1 text-xs whitespace-nowrap text-foreground/60",
              "hover:bg-input/20 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              "dark:text-muted-foreground dark:hover:bg-input/20",
              "data-[active]:font-medium data-[active]:text-foreground",
              "dark:data-[active]:border-input dark:data-[active]:text-accent",
              "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            )}
          >
            {link.icon}
            {link.label}
            {link.hasBadge && (
              <Badge className="absolute inset-e-2 top-1 size-2.5 rounded-full p-0" />
            )}
          </a>
        ))}
      </div>

      <a
        href="/settings"
        aria-label="Me"
        className={cn(
          "flex size-14 shrink-0 rounded-full border bg-muted p-1",
          currentPath.includes("/settings")
            ? "border-2 border-accent"
            : "border-border",
        )}
      >
        {profileMediaHash ? (
          <UserAvatar
            mediaHash={profileMediaHash}
            className="size-full [&>*]:rounded-full"
            size="lg"
          />
        ) : (
          <BrokenUserAvatar className="size-full" />
        )}
      </a>
    </ProgressiveBlur>
  );
}
