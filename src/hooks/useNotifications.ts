import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useNotifications() {
  const qc = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      return res.json();
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { notifications: data?.notifications ?? [], isLoading, markRead: markRead.mutate };
}
