import { type ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold-ghost text-gold">
          {icon}
        </span>
      )}
      <div>
        <p className="text-[16px] font-semibold text-ink">{title}</p>
        {children && <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">{children}</p>}
      </div>
    </div>
  );
}
