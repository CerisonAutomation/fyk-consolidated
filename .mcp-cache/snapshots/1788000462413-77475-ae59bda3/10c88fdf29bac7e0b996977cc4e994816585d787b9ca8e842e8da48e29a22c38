import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Terminal, User, Funnel, Search, MapPin } from "lucide-react";
import { Kbd } from "../atoms/Kbd";

interface CommandSuggestionItem {
  prefix: string;
  command: string;
  icon: ReactNode;
}

interface CommandCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when a command is selected */
  onCommand?: (command: string) => void;
  /** Custom command groups to render based on query prefix */
  commandGroups?: Record<string, ReactNode>;
  className?: string;
}

const SUGGESTIONS: CommandSuggestionItem[] = [
  { prefix: "#", command: "open profile by id", icon: <User className="size-4" /> },
  { prefix: "?", command: "filter grid", icon: <Funnel className="size-4" /> },
  { prefix: "/", command: "quick go to", icon: <Search className="size-4" /> },
  { prefix: "@", command: "set location by geohash", icon: <MapPin className="size-4" /> },
];

export function CommandCenter({
  open,
  onOpenChange,
  onCommand,
  commandGroups = {},
  className,
}: CommandCenterProps): ReactNode {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  // Reset query when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => i + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onCommand?.(query);
      }
    },
    [onOpenChange, onCommand, query],
  );

  if (!open) return null;

  const showSuggestions = query.length === 0;
  const matchedPrefix = query.length > 0 ? query[0] : null;
  const matchingGroup = matchedPrefix ? commandGroups[matchedPrefix] : null;

  return (
    <div className={className}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl">
          {/* Input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Terminal className="size-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Quick actions..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Kbd className="text-[10px]">ESC</Kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {showSuggestions && (
              <div>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Suggestions
                </div>
                {SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={suggestion.prefix}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      setQuery(suggestion.prefix);
                      setSelectedIndex(0);
                    }}
                  >
                    <span className="text-muted-foreground">
                      {suggestion.icon}
                    </span>
                    <span className="text-muted-foreground">
                      {suggestion.prefix}
                    </span>
                    <span>{suggestion.command}</span>
                  </button>
                ))}
              </div>
            )}

            {!showSuggestions && matchingGroup && <div>{matchingGroup}</div>}

            {!showSuggestions && !matchingGroup && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                Unknown command
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
