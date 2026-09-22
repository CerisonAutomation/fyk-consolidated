import { useQueries as useTanQueries } from "@tanstack/react-query";

export function useQueries<T>(queries: Array<{ key: string[]; url: string }>) {
  return useTanQueries({
    queries: queries.map((q) => ({
      queryKey: q.key,
      queryFn: async () => {
        const res = await fetch(q.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<T>;
      },
    })),
  });
}
