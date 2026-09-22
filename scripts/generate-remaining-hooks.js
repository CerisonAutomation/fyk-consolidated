import fs from 'fs';

const hooks = [
  {
    name: 'useQueries',
    content: `import { useQueries as useTanQueries } from "@tanstack/react-query";

export function useQueries<T>(queries: Array<{ key: string[]; url: string }>) {
  return useTanQueries({
    queries: queries.map((q) => ({
      queryKey: q.key,
      queryFn: async () => {
        const res = await fetch(q.url);
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        return res.json() as Promise<T>;
      },
    })),
  });
}
`,
  },
  {
    name: 'useEventSuggestions',
    content: `import { useQuery } from "@tanstack/react-query";

export function useEventSuggestions(userId: string) {
  return useQuery({
    queryKey: ["event-suggestions", userId],
    queryFn: async () => {
      const res = await fetch(\`/api/events/suggestions?userId=\${userId}\`);
      return res.json();
    },
    enabled: !!userId,
  });
}
`,
  },
  {
    name: 'useMatch',
    content: `import { useQuery } from "@tanstack/react-query";

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
`,
  },
  {
    name: 'useNotifications',
    content: `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
      await fetch(\`/api/notifications/\${id}/read\`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { notifications: data?.notifications ?? [], isLoading, markRead: markRead.mutate };
}
`,
  },
  {
    name: 'useVideoCall',
    content: `import { useState, useCallback, useRef } from "react";

export function useVideoCall(conversationId: string) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  const startCall = useCallback(async () => {
    setIsInCall(true);
    // WebRTC signaling via Supabase Realtime
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localRef.current) localRef.current.srcObject = stream;
  }, []);

  const endCall = useCallback(() => {
    setIsInCall(false);
    // Cleanup
  }, []);

  const toggleMute = useCallback(() => setIsMuted((m) => !m), []);
  const toggleVideo = useCallback(() => setIsVideoOff((v) => !v), []);

  return { isInCall, isMuted, isVideoOff, localRef, remoteRef, startCall, endCall, toggleMute, toggleVideo, conversationId };
}
`,
  },
  {
    name: 'useAIChat',
    content: `export { useAIChat } from "./prd-hooks";`,
  },
  {
    name: 'useAISearch',
    content: `export { useAISearch } from "./prd-hooks";`,
  },
  {
    name: 'useRealtimeSync',
    content: `export { useRealtimeSync } from "./prd-hooks";`,
  },
  {
    name: 'useTypingSender',
    content: `export { useTypingSender } from "./prd-hooks";`,
  },
  {
    name: 'useIsUserOnline',
    content: `export { useIsUserOnline } from "./prd-hooks";`,
  },
  {
    name: 'useGesture',
    content: `export { useGesture } from "./prd-hooks";`,
  },
  {
    name: 'useEdgeSwipe',
    content: `export { useEdgeSwipe } from "./prd-hooks";`,
  },
  {
    name: 'useLongPress',
    content: `export { useLongPress } from "./prd-hooks";`,
  },
  {
    name: 'useHaptics',
    content: `export { useHaptics } from "./prd-hooks";`,
  },
  {
    name: 'useMediaQuery',
    content: `export { useMediaQuery } from "./prd-hooks";`,
  },
  {
    name: 'useMobile',
    content: `export { useMobile } from "./prd-hooks";`,
  },
  {
    name: 'useIntersectionObserver',
    content: `export { useIntersectionObserver } from "./prd-hooks";`,
  },
  {
    name: 'useDebounce',
    content: `export { useDebounce } from "./prd-hooks";`,
  },
  {
    name: 'useThrottle',
    content: `export { useThrottle } from "./prd-hooks";`,
  },
  {
    name: 'useAnimatedCounter',
    content: `export { useAnimatedCounter } from "./prd-hooks";`,
  },
  {
    name: 'useFetch',
    content: `export { useFetch } from "./prd-hooks";`,
  },
  {
    name: 'useApiQuery',
    content: `export { useApiQuery } from "./prd-hooks";`,
  },
  {
    name: 'useSendMessageMutation',
    content: `export { useSendMessageMutation } from "./prd-hooks";`,
  },
  {
    name: 'useProfiles',
    content: `export { useProfiles } from "./prd-hooks";`,
  },
  {
    name: 'useProfileFilters',
    content: `export { useProfileFilters } from "./prd-hooks";`,
  },
  {
    name: 'useFuzzySearch',
    content: `export { useFuzzySearch } from "./prd-hooks";`,
  },
  {
    name: 'useSafety',
    content: `export { useSafety } from "./prd-hooks";`,
  },
  {
    name: 'useSubscription',
    content: `export { useSubscription } from "./prd-hooks";`,
  },
  {
    name: 'useXPRewards',
    content: `export { useXPRewards } from "./prd-hooks";`,
  },
  {
    name: 'useLocation',
    content: `export { useLocation } from "./prd-hooks";`,
  },
  {
    name: 'usePushNotifications',
    content: `export { usePushNotifications } from "./prd-hooks";`,
  },
  {
    name: 'useStreak',
    content: `export { useStreak } from "./prd-hooks";`,
  },
  {
    name: 'useMessageExpiry',
    content: `export { useMessageExpiry } from "./prd-hooks";`,
  },
  {
    name: 'useDNDTimer',
    content: `export { useDNDTimer } from "./prd-hooks";`,
  },
  {
    name: 'useFeatureFlags',
    content: `export { useFeatureFlags } from "./prd-hooks";`,
  },
  {
    name: 'useI18n',
    content: `export { useI18n } from "./prd-hooks";`,
  },
  {
    name: 'useSupabaseAuth',
    content: `export { useSupabaseAuth } from "./prd-hooks";`,
  },
];

for (const hook of hooks) {
  const path = `/home/user/fyk-consolidated/src/hooks/${hook.name}.ts`;
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, hook.content, 'utf8');
    console.log(`Generated ${hook.name}`);
  } else {
    console.log(`Exists ${hook.name}, skipping`);
  }
}
