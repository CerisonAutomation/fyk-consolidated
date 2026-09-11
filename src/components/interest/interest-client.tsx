"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
 Heart, Users, Eye, Star, FileText, Crown,
} from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import { EmptyState, Skeleton, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface InterestProfile {
 id: string;
 name: string;
 age: number;
 photo: string;
 distance: number;
 status: "online" | "active" | "offline";
 verified?: boolean;
 matched?: boolean;
 likedYou?: boolean;
 isFavourite?: boolean;
 note?: string;
 lastSeen?: string;
}

type TabId = "likes" | "matches" | "visitors" | "favourites" | "notes";

interface Stats {
 likesReceived: number;
 matches: number;
 tapsSent: number;
 woofsSent: number;
}

const TABS: { id: TabId; label: string; icon: typeof Heart }[] = [
 { id: "likes", label: "Likes you", icon: Heart },
 { id: "matches", label: "Matches", icon: Users },
 { id: "visitors", label: "Visitors", icon: Eye },
 { id: "favourites", label: "Favourites", icon: Star },
 { id: "notes", label: "Notes", icon: FileText },
];

export function InterestClient() {
 const qc = useQueryClient();
 const pushToast = useAppStore((s) => s.pushToast);
 const user = useAppStore((s) => s.user);
 const [activeTab, setActiveTab] = useState<TabId>("likes");

 const { data: stats, isLoading: statsLoading } = useQuery({
   queryKey: ["interest-stats"],
   queryFn: () => api<{ stats: Stats }>("/api/interest/stats").then((r) => r.stats),
 });

 const { data: profiles, isLoading: profilesLoading } = useQuery({
   queryKey: ["interest", activeTab],
   queryFn: () =>
     api<{ profiles: InterestProfile[] }>(`/api/interest/${activeTab}`).then((r) => r.profiles),
 });

 const likeBack = useMutation({
   mutationFn: (profileId: string) =>
     api("/api/interest/like", { method: "POST", body: { profileId } }),
   onSuccess: () => {
     pushToast("You liked them back! 💕");
     qc.invalidateQueries({ queryKey: ["interest"] });
   },
 });

 const toggleFavourite = useMutation({
   mutationFn: ({ profileId, isFavourite }: { profileId: string; isFavourite: boolean }) =>
     api("/api/interest/favourite", {
       method: "POST",
       body: { profileId, action: isFavourite ? "remove" : "add" },
     }),
   onSuccess: () => {
     qc.invalidateQueries({ queryKey: ["interest", "favourites"] });
   },
 });

 const profilesList = profiles ?? [];
 const isPlus = user?.tier !== "free";

 return (
   <div className="mx-auto max-w-4xl px-4 py-6">
     {/* Header */}
     <div className="mb-6">
       <h1 className="text-2xl font-bold text-white">Likes</h1>
       <p className="mt-1 text-sm text-white/60">
         Who noticed you, who you saved, and who dropped by.
       </p>
     </div>

     {/* Stats Cards */}
     {statsLoading ? (
       <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
         {Array.from({ length: 4 }).map((_, i) => (
           <Skeleton key={i} className="h-24 rounded-2xl" />
         ))}
       </div>
     ) : stats ? (
       <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
         <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
           <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20">
             <Heart className="h-4 w-4 text-red-400" />
           </div>
           <p className="text-2xl font-bold text-white">{stats.likesReceived}</p>
           <p className="text-xs text-white/40">Likes received</p>
         </div>
         <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
           <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/20">
             <Users className="h-4 w-4 text-yellow-400" />
           </div>
           <p className="text-2xl font-bold text-white">{stats.matches}</p>
           <p className="text-xs text-white/40">Matches</p>
         </div>
         <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
           <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
             <Eye className="h-4 w-4 text-purple-400" />
           </div>
           <p className="text-2xl font-bold text-white">{stats.tapsSent}</p>
           <p className="text-xs text-white/40">Taps sent</p>
         </div>
         <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
           <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20">
             <Star className="h-4 w-4 text-orange-400" />
           </div>
           <p className="text-2xl font-bold text-white">{stats.woofsSent}</p>
           <p className="text-xs text-white/40">Woofs sent</p>
         </div>
       </div>
     ) : null}

     {/* Tabs */}
     <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
       {TABS.map((tab) => {
         const Icon = tab.icon;
         return (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id)}
             className={cn(
               "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
               activeTab === tab.id
                 ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
                 : "border-white/20 bg-white/5 text-white/60 hover:text-white"
             )}
           >
             <Icon className="h-4 w-4" />
             {tab.label}
           </button>
         );
       })}
     </div>

     {/* Plus Banner (only on likes tab) */}
     {activeTab === "likes" && !isPlus && (
       <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
         <div className="flex items-center gap-3">
           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/20">
             <Crown className="h-5 w-5 text-yellow-400" />
           </div>
           <div className="flex-1">
             <p className="text-sm font-semibold text-white">
               Free shows the three most recent likes clearly. Plus reveals everyone.
             </p>
           </div>
           <button className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400">
             Switch to Plus
           </button>
         </div>
       </div>
     )}

     {/* Profiles Grid */}
     {profilesLoading ? (
       <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
         {Array.from({ length: 8 }).map((_, i) => (
           <Skeleton key={i} className="h-72 rounded-2xl" />
         ))}
       </div>
     ) : profilesList.length === 0 ? (
       <EmptyState
         title={
           activeTab === "likes"
             ? "No likes yet"
             : activeTab === "matches"
               ? "No matches yet"
               : activeTab === "visitors"
                 ? "No visitors yet"
                 : activeTab === "favourites"
                   ? "No favourites yet"
                   : "No notes yet"
         }
         description={
           activeTab === "likes"
             ? "When someone likes you, they'll appear here."
             : activeTab === "matches"
               ? "Match with someone to start chatting."
               : activeTab === "visitors"
                 ? "People who viewed your profile will appear here."
                 : activeTab === "favourites"
                   ? "Save profiles you like to find them later."
                   : "Add notes to profiles to remember details."
         }
       />
     ) : (
       <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
         {profilesList.map((profile) => (
           <div
             key={profile.id}
             className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20"
           >
             {/* Like Badge */}
             {activeTab === "likes" && profile.likedYou && (
               <div className="absolute left-3 top-3 z-10">
                 <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
                   <Heart className="h-4 w-4 fill-current" />
                 </span>
               </div>
             )}

             {/* Match Badge */}
             {activeTab === "matches" && profile.matched && (
               <div className="absolute left-3 top-3 z-10">
                 <span className="flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-1 text-xs font-bold text-black">
                   <Heart className="h-3 w-3 fill-current" /> Match
                 </span>
               </div>
             )}

             {/* Favourite Button */}
             <button
               onClick={() =>
                 toggleFavourite.mutate({
                   profileId: profile.id,
                   isFavourite: profile.isFavourite ?? false,
                 })
               }
               className="absolute right-3 top-3 z-10"
             >
               <Star
                 className={cn(
                   "h-6 w-6 transition-colors",
                   profile.isFavourite
                     ? "fill-yellow-400 text-yellow-400"
                     : "text-white/40 hover:text-yellow-400"
                 )}
               />
             </button>

             {/* Photo */}
             <div className="relative h-48 overflow-hidden">
               <img
                 src={profile.photo}
                 alt={`${profile.name}, ${profile.age}`}
                 className="h-full w-full object-cover transition-transform group-hover:scale-105"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
               <div className="absolute bottom-3 left-3 right-3">
                 <p className="text-lg font-bold text-white">{profile.name}, {profile.age}</p>
                 <p className="text-sm text-white/70">
                   {profile.distance} mi ·{" "}
                   {profile.status === "online"
                     ? "Online now"
                     : profile.status === "active"
                       ? "Active recently"
                       : "Active this week"}
                 </p>
               </div>
             </div>

             {/* Actions */}
             <div className="p-3">
               {activeTab === "likes" && profile.likedYou ? (
                 <Button
                   onClick={() => likeBack.mutate(profile.id)}
                   disabled={likeBack.isPending}
                   className="w-full rounded-xl bg-yellow-500 py-2 text-sm font-semibold text-black hover:bg-yellow-400"
                 >
                   Like back
                 </Button>
               ) : activeTab === "matches" ? (
                 <Button className="w-full rounded-xl bg-yellow-500 py-2 text-sm font-semibold text-black hover:bg-yellow-400">
                   Say hi
                 </Button>
               ) : activeTab === "notes" && profile.note ? (
                 <p className="line-clamp-2 text-sm text-white/60">{profile.note}</p>
               ) : (
                 <Button className="w-full rounded-xl border border-white/20 bg-transparent py-2 text-sm font-semibold text-white hover:bg-white/10">
                   View profile
                 </Button>
               )}
             </div>
           </div>
         ))}
       </div>
     )}
   </div>
 );
}
