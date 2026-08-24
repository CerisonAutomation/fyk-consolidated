import type { ReactNode } from "react";
import { cn } from "../cn";
import { NavBar } from "../organisms/NavBar";

interface AppLayoutProps {
  children: ReactNode;
  /** User's profile photo media hash */
  profileMediaHash?: string | null;
  /** Whether there are unread messages */
  hasUnread?: boolean;
  /** Whether there are unseen taps/interests */
  hasUnseenTaps?: boolean;
  className?: string;
}

export function AppLayout({
  children,
  profileMediaHash,
  hasUnread,
  hasUnseenTaps,
  className,
}: AppLayoutProps): ReactNode {
  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      <main className="flex-1 pb-20">{children}</main>
      <NavBar
        profileMediaHash={profileMediaHash}
        hasUnread={hasUnread}
        hasUnseenTaps={hasUnseenTaps}
      />
    </div>
  );
}
