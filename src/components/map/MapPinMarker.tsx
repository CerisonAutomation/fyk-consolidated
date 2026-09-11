import { cn } from "#/utils/cn";

export interface MapPinMarkerProps {
  photo?: string;
  label?: string;
  online?: boolean;
  accent?: boolean;
  emoji?: string;
  onClick?: () => void;
}

/**
 * Individual pin marker rendered as a DOM element for Mapbox GL JS custom markers.
 * Handles photos, initials, online indicators, accent glow, and emoji labels.
 */
export function MapPinMarker({
  photo,
  label,
  online,
  accent,
  emoji,
  onClick,
}: MapPinMarkerProps) {
  const initials = label
    ? label
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "group/fyk-pin relative flex flex-col items-center cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black",
      )}
      aria-label={label ?? "Map pin"}
    >
      {/* Pin body */}
      <div
        className={cn(
          "relative flex items-center justify-center",
          "w-10 h-10 rounded-full border-2 transition-transform duration-150 ease-out",
          "group-hover/fyk-pin:scale-110 group-active/fyk-pin:scale-95",
          accent
            ? "border-gold shadow-[0_0_12px_2px_rgba(212,175,55,0.5)]"
            : "border-white/80 shadow-lg",
          photo ? "overflow-hidden bg-surface" : "bg-gold text-black font-bold text-sm",
        )}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            className="w-full h-full object-cover rounded-full"
            draggable={false}
          />
        ) : (
          <span className="select-none leading-none">{initials}</span>
        )}

        {/* Online indicator */}
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-black bg-emerald-500" />
        )}
      </div>

      {/* Emoji label below pin */}
      {emoji && (
        <span className="mt-0.5 text-xs leading-none select-none" aria-hidden>
          {emoji}
        </span>
      )}
    </button>
  );
}
