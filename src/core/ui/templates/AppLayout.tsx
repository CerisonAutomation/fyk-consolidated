import type { ReactNode } from "react";
import { cn } from "../cn";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppLayout({
  children,
  className,
}: AppLayoutProps): ReactNode {
  return (
    <div className={cn("min-h-screen", className)}>
      <main>{children}</main>
    </div>
  );
}
