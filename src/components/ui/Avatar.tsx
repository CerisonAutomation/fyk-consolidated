import { cn } from "@/utils/cn";

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  online?: boolean;
  verified?: boolean;
  className?: string;
}

export function Avatar({ name, photoUrl, size = 40, online, verified, className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-gold/20 text-gold font-semibold"
          style={{ fontSize: size * 0.35 }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface",
            online ? "bg-emerald-400" : "bg-neutral-500"
          )}
        />
      )}
    </div>
  );
}
