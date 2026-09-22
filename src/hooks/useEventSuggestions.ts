import { useQuery } from "@tanstack/react-query";

export function useEventSuggestions(userId: string) {
  return useQuery({
    queryKey: ["event-suggestions", userId],
    queryFn: async () => {
      const res = await fetch(`/api/events/suggestions?userId=${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });
}
