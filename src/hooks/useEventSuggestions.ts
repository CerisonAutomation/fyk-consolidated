import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";

/**
 * Upcoming events near the caller.
 *
 * This fetched `/api/events/suggestions?userId={id}` — a path nothing serves, with
 * the caller's own id as a parameter the server would have had to trust. The
 * canonical read is `#/routes/api/events`, which takes the session for identity and
 * a city for relevance, and answers `{events, nextCursor}`.
 *
 * `userId` stays in the query key so two accounts on one device do not share a
 * cache entry, and it is not sent: the bearer token says who is asking.
 */
export function useEventSuggestions(userId: string, city?: string) {
  return useQuery({
    queryKey: ["event-suggestions", userId, city ?? ""],
    // Two literals rather than one interpolation: `/api/events${city ? ... : ""}` is a
    // path no reader (or contract auditor) can resolve without running the template, and
    // both branches are short enough to write out.
    queryFn: () =>
      city
        ? api<{ events: unknown[]; nextCursor?: string | null }>(
            `/api/events?city=${encodeURIComponent(city)}`,
          )
        : api<{ events: unknown[]; nextCursor?: string | null }>("/api/events"),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
