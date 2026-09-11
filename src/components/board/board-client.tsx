"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Zap, X, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import { Skeleton, Button, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type AvailabilityStatus = "available" | "busy" | "away";

interface BoardPost {
 id: string;
 userId: string;
 userName: string;
 userAge: number;
 userPhoto: string;
 distance: number;
 status: AvailabilityStatus;
 activity: string;
 window: string;
 note?: string;
 liveUntil: string;
 tags: string[];
 joined: boolean;
 joinCount: number;
 createdAt: string;
}

interface BoardState {
 isAvailable: boolean;
 activity: string;
 window: string;
 note: string;
}

const ACTIVITIES = [
 "Coffee", "Drinks", "Dinner", "Beach", "Cinema", "Gaming", "Gym",
 "Hiking", "Tour guide", "Karaoke", "Chill", "Hookup", "Group", "Date",
] as const;

const WINDOWS = [
 "Now · 1h", "Now · 2h", "Now · 4h", "Today · afternoon", "Today · evening",
 "Tomorrow · morning", "Tomorrow · evening", "This weekend",
] as const;

const FILTERS = ["Everything", "Open Invite", "Offering", "Looking For", "Photo"] as const;

const ACTIVITY_EMOJI: Record<string, string> = {
 Coffee: "☕", Drinks: "🍸", Dinner: "🍽️", Beach: "🏖️", Cinema: "🎬",
 Gaming: "🎮", Gym: "🏋️", Hiking: "🥾", "Tour guide": "🗺️",
 Karaoke: "🎤", Chill: "😌", Hookup: "🔥", Group: "👥", Date: "💕",
};

function formatTimeRemaining(liveUntil: string): string {
 const now = new Date();
 const end = new Date(liveUntil);
 const diff = end.getTime() - now.getTime();
 if (diff <= 0) return "Ended";
 const hours = Math.floor(diff / (1000 * 60 * 60));
 const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 if (hours > 0) return `${hours}h ${minutes}m left`;
 return `${minutes}m left`;
}

export function BoardClient() {
 const qc = useQueryClient();
 const pushToast = useAppStore((s) => s.pushToast);

 const [composing, setComposing] = useState(false);
 const [filter, setFilter] = useState<string>("Everything");
 const [boardState, setBoardState] = useState<BoardState>({
   isAvailable: false,
   activity: "Coffee",
   window: "Now · 2h",
   note: "",
 });

 const { data: posts, isLoading } = useQuery({
   queryKey: ["board"],
   queryFn: () => api<{ posts: BoardPost[] }>("/api/board").then((r) => r.posts),
   refetchInterval: 30000,
 });

 const setAvailability = useMutation({
   mutationFn: (state: BoardState) =>
     api("/api/board", { method: "POST", body: { action: "availability", ...state } }),
   onSuccess: () => {
     setBoardState((s) => ({ ...s, isAvailable: !s.isAvailable }));
     pushToast(boardState.isAvailable ? "You're now offline" : "You're now available 🟢");
     qc.invalidateQueries({ queryKey: ["board"] });
   },
 });

 const joinPost = useMutation({
   mutationFn: (postId: string) =>
     api("/api/board", { method: "POST", body: { action: "join", postId } }),
   onSuccess: () => {
     pushToast("Joined! They've been notified ⚡");
     qc.invalidateQueries({ queryKey: ["board"] });
   },
 });

 const createPost = useMutation({
   mutationFn: () =>
     api("/api/board", {
       method: "POST",
       body: {
         action: "post",
         activity: boardState.activity,
         window: boardState.window,
         note: boardState.note,
       },
     }),
   onSuccess: () => {
     setComposing(false);
     setBoardState((s) => ({ ...s, note: "" }));
     pushToast("Your plan is live 🎯");
     qc.invalidateQueries({ queryKey: ["board"] });
   },
 });

 const filteredPosts = (posts ?? []).filter((p) => {
   if (filter === "Open Invite") return !p.joined && p.joinCount < (p.tags.includes("Group") ? 6 : 2);
   if (filter === "Offering") return p.activity !== "Hookup";
   if (filter === "Looking For") return p.tags.some((t) => ["Date", "Chat", "Friends"].includes(t));
   if (filter === "Photo") return p.userPhoto;
   return true;
 });

 return (
   <div className="mx-auto max-w-4xl px-4 py-6">
     <div className="mb-6">
       <h1 className="text-2xl font-bold text-white">Board</h1>
       <p className="mt-1 text-sm text-white/60">
         Say what you're actually up for and for how long. Coffee, the beach, a controller, a lift to
         the airport, a date, a hookup — all of it counts, none of it is permanent.
       </p>
     </div>

     {/* Availability Banner */}
     <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
       <div className="flex items-center gap-4">
         <div className={cn(
           "flex h-12 w-12 items-center justify-center rounded-xl",
           boardState.isAvailable ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
         )}>
           <Zap className="h-6 w-6" />
         </div>
         <div className="flex-1">
           <p className="font-semibold text-white">
             {boardState.isAvailable ? "You're showing as available" : "You're not showing as available"}
           </p>
           <p className="text-sm text-white/60">
             {boardState.isAvailable
               ? "People nearby can see your availability on your card."
               : "Set it once and it clears itself. People nearby see it on your card."}
           </p>
         </div>
         <Button
           onClick={() => setAvailability.mutate(boardState)}
           disabled={setAvailability.isPending}
           className={cn(
             "rounded-xl px-4 py-2 text-sm font-semibold",
             boardState.isAvailable
               ? "border border-white/20 bg-transparent text-white hover:bg-white/10"
               : "bg-yellow-500 text-black hover:bg-yellow-400"
           )}
         >
           {boardState.isAvailable ? "Set offline" : "Set availability"}
         </Button>
       </div>
     </div>

     {/* Filters */}
     <div className="mb-4 flex flex-wrap gap-2">
       {FILTERS.map((f) => (
         <button
           key={f}
           onClick={() => setFilter(f)}
           className={cn(
             "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
             filter === f
               ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
               : "border-white/20 bg-white/5 text-white/60 hover:text-white"
           )}
         >
           {f}
         </button>
       ))}
     </div>

     {/* Posts Grid */}
     {isLoading ? (
       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
         {Array.from({ length: 6 }).map((_, i) => (
           <Skeleton key={i} className="h-64 rounded-2xl" />
         ))}
       </div>
     ) : filteredPosts.length === 0 ? (
       <EmptyState
         title="No plans right now"
         description="Be the first to post what you're up for today."
       />
     ) : (
       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
         {filteredPosts.map((post) => (
           <div
             key={post.id}
             className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20"
           >
             {/* LIVE Badge */}
             <div className="absolute left-3 top-3 z-10">
               <span className="flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-bold text-white">
                 <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                 LIVE
               </span>
             </div>

             {/* Time Remaining */}
             <div className="absolute right-3 top-3 z-10">
               <span className="rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                 {formatTimeRemaining(post.liveUntil)}
               </span>
             </div>

             {/* User Photo */}
             <div className="relative h-48 overflow-hidden">
               <img
                 src={post.userPhoto}
                 alt={`${post.userName}, ${post.userAge}`}
                 className="h-full w-full object-cover transition-transform group-hover:scale-105"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
               <div className="absolute bottom-3 left-3 right-3">
                 <p className="text-lg font-bold text-white">{post.userName}, {post.userAge}</p>
                 <p className="text-sm text-white/70">{post.distance} mi · {post.status === "available" ? "Online now" : "Active recently"}</p>
               </div>
             </div>

             {/* Activity & Tags */}
             <div className="p-4">
               <div className="mb-3 flex items-center gap-2">
                 <span className="text-lg">{ACTIVITY_EMOJI[post.activity] ?? "✨"}</span>
                 <span className="font-semibold text-white">{post.activity}</span>
                 <span className="text-sm text-white/40">· {post.window}</span>
               </div>

               {post.note && (
                 <p className="mb-3 line-clamp-2 text-sm text-white/60">{post.note}</p>
               )}

               <div className="flex flex-wrap gap-1.5">
                 {post.tags.map((tag) => (
                   <span
                     key={tag}
                     className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
                   >
                     {tag}
                   </span>
                 ))}
               </div>

               {/* Join Button */}
               <div className="mt-4 flex items-center justify-between">
                 <span className="text-xs text-white/40">
                   {post.joinCount} {post.joinCount === 1 ? "person" : "people"} joined
                 </span>
                 <Button
                   onClick={() => joinPost.mutate(post.id)}
                   disabled={post.joined || joinPost.isPending}
                   className={cn(
                     "rounded-xl px-3 py-1.5 text-sm font-semibold",
                     post.joined
                       ? "bg-white/10 text-white/40"
                       : "bg-yellow-500 text-black hover:bg-yellow-400"
                   )}
                 >
                   {post.joined ? "Joined" : "Join"}
                 </Button>
               </div>
             </div>
           </div>
         ))}
       </div>
     )}

     {/* Compose Button */}
     <div className="fixed bottom-24 right-6 z-40 lg:bottom-6">
       <button
         onClick={() => setComposing(true)}
         className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500 text-black shadow-lg transition-transform hover:scale-105 hover:bg-yellow-400"
       >
         <Plus className="h-6 w-6" />
       </button>
     </div>

     {/* Compose Modal */}
     {composing && (
       <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
         <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6">
           <div className="mb-4 flex items-center justify-between">
             <h2 className="text-lg font-bold text-white">Post a plan</h2>
             <button onClick={() => setComposing(false)} className="text-white/40 hover:text-white">
               <X className="h-5 w-5" />
             </button>
           </div>

           {/* Activity Selection */}
           <div className="mb-4">
             <label className="mb-2 block text-sm font-medium text-white/60">Activity</label>
             <div className="flex flex-wrap gap-2">
               {ACTIVITIES.map((a) => (
                 <button
                   key={a}
                   onClick={() => setBoardState((s) => ({ ...s, activity: a }))}
                   className={cn(
                     "rounded-full border px-3 py-1.5 text-sm transition-colors",
                     boardState.activity === a
                       ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
                       : "border-white/20 bg-white/5 text-white/60 hover:text-white"
                   )}
                 >
                   {ACTIVITY_EMOJI[a]} {a}
                 </button>
               ))}
             </div>
           </div>

           {/* Window Selection */}
           <div className="mb-4">
             <label className="mb-2 block text-sm font-medium text-white/60">When</label>
             <div className="flex flex-wrap gap-2">
               {WINDOWS.map((w) => (
                 <button
                   key={w}
                   onClick={() => setBoardState((s) => ({ ...s, window: w }))}
                   className={cn(
                     "rounded-full border px-3 py-1.5 text-sm transition-colors",
                     boardState.window === w
                       ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
                       : "border-white/20 bg-white/5 text-white/60 hover:text-white"
                   )}
                 >
                   {w}
                 </button>
               ))}
             </div>
           </div>

           {/* Note */}
           <div className="mb-4">
             <label className="mb-2 block text-sm font-medium text-white/60">Note (optional)</label>
             <textarea
               value={boardState.note}
               onChange={(e) => setBoardState((s) => ({ ...s, note: e.target.value }))}
               placeholder="What's the plan? Any details?"
               className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-yellow-500/50 focus:outline-none"
               rows={3}
             />
           </div>

           {/* Actions */}
           <div className="flex gap-3">
             <Button
               onClick={() => setComposing(false)}
               className="flex-1 rounded-xl border border-white/20 bg-transparent py-2.5 text-sm font-semibold text-white hover:bg-white/10"
             >
               Cancel
             </Button>
             <Button
               onClick={() => createPost.mutate()}
               disabled={createPost.isPending}
               className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-semibold text-black hover:bg-yellow-400"
             >
               {createPost.isPending ? "Posting..." : "Post plan"}
             </Button>
           </div>
         </div>
       </div>
     )}
   </div>
 );
}
