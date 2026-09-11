import { cn, initials, gradient } from "@/lib/utils";

export function Avatar({
  name,
  photoUrl,
  size = 40,
  online,
  verified,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  online?: boolean;
  verified?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full text-white"
          style={{
            background: gradient(name),
            fontSize: size * 0.36,
            fontWeight: 700,
          }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 block rounded-full border-2 border-ink bg-emerald-500"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
      {verified && !online && (
        <span
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border-2 border-ink bg-gold text-ink"
          style={{ width: size * 0.28, height: size * 0.28, fontSize: size * 0.16 }}
        >
          ✓
        </span>
      )}
    </div>
  );
}
