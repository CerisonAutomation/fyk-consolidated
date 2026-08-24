import type { ReactNode } from "react";
import { cn } from "../cn";

interface AuthLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps): ReactNode {
  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-background px-4 py-8",
        className,
      )}
    >
      <div className="w-full max-w-sm space-y-6">{children}</div>
    </div>
  );
}
