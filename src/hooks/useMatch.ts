import { useQuery } from "@tanstack/react-query";

export function useMatch(profileId: string, targetId: string) {
  return useQuery({
    queryKey: ["match", profileId, targetId],
    queryFn: async () => {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, targetId }),
      });
      return res.json();
    },
    enabled: !!profileId && !!targetId,
  });
}
