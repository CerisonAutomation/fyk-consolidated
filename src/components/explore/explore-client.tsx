"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
 MapPin, Shield, MessageCircle, Home, Zap, Lock, ChevronDown,
} from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface City {
 id: string;
 name: string;
 country: string;
 flag: string;
 onlineCount: number;
 photo: string;
}

interface ExploreProfile {
 id: string;
 name: string;
 age: number;
 photo: string;
 distance: number;
 status: "online" | "active" | "offline";
 verified?: boolean;
 hosting?: boolean;
 lookingFor: string[];
 tags: string[];
 activity?: string;
}

type SortKey = "distance" | "recent" | "compat";

const FILTERS = [
 { id: "online", label: "Online now", icon: Zap },
 { id: "verified", label: "Verified", icon: Shield },
 { id: "chat", label: "Looking for: Chat", icon: MessageCircle },
 { id: "hosting", label: "Hosting tonight", icon: Home },
 { id: "free", label: "Free right now", icon: Zap },
 { id: "album", label: "Private album", icon: Lock },
] as const;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
 { value: "distance", label: "Distance" },
 { value: "recent", label: "Recently active" },
 { value: "compat", label: "Compatibility" },
];

export function ExploreClient() {
 const pushToast = useAppStore((s) => s.pushToast);
 const user = useAppStore((s) => s.user);

 const [selectedCity, setSelectedCity] = useState("valletta");
 const [travelMode, setTravelMode] = useState(false);
 const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(["online"]));
 const [sort, setSort] = useState<SortKey>("distance");
 const [layout, setLayout] = useState<"grid" | "list">("grid");

 const { data: cities, isLoading: citiesLoading } = useQuery({
   queryKey: ["explore-cities"],
   queryFn: () => api<{ cities: City[] }>("/api/explore/cities").then((r) => r.cities),
 });

 const { data: profiles, isLoading: profilesLoading } = useQuery({
   queryKey: ["explore", selectedCity, Array.from(activeFilters).join(","), sort],
   queryFn: () =>
     api<{ profiles: ExploreProfile[] }>(
       `/api/explore/${selectedCity}?filters=${Array.from(activeFilters).join(",")}&sort=${sort}`
     ).then((r) => r.profiles),
 });

 const toggleTravelMode = useMutation({
   mutationFn: () =>
     api("/api/explore/travel", {
       method: "POST",
       body: { city: selectedCity, enabled: !travelMode },
     }),
   onSuccess: () => {
     setTravelMode((t) => !t);
     pushToast(
       travelMode
         ? "Travel mode off — back to your location"
         : `Traveling · visible in ${selectedCity} shortly`
     );
   },
 });

 const toggleFilter = (filterId: string) => {
   setActiveFilters((prev) => {
     const next = new Set(prev);
     if (next.has(filterId)) {
       next.delete(filterId);
     } else {
       next.add(filterId);
     }
     return next;
   });
 };

 const citiesList = cities ?? [];
 const profilesList = profiles ?? [];
 const selectedCityData = citiesList.find((c) => c.id === selectedCity);

 return (
   <div className="mx-auto max-w-6xl px-4 py-6">
     {/* Header */}
     <div className="mb-6">
       <h1 className="text-2xl font-bold text-white">Explore</h1>
       <p className="mt-1 text-sm text-white/60">
         Pick a city and look around before you travel. Offline city set — no external geocoder.
       </p>
     </div>

     {/* City Cards */}
     {citiesLoading ? (
       <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
         {Array.from({ length: 5 }).map((_, i) => (
           <Skeleton key={i} className="h-32 w-48 shrink-0 rounded-2xl" />
         ))}
       </div>
     ) : (
       <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
         {citiesList.map((city) => (
           <button
             key={city.id}
             onClick={() => setSelectedCity(city.id)}
             className={cn(
               "group relative h-32 w-48 shrink-0 overflow-hidden rounded-2xl border transition-all",
               selectedCity === city.id
                 ? "border-yellow-500/50 ring-2 ring-yellow-500/30"
                 : "border-white/10 hover:border-white/20"
             )}
           >
             <img
               src={city.photo}
               alt={city.name}
               className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
             <div className="absolute bottom-3 left-3 right-3">
               <p className="flex items-center gap-1 text-sm font-bold text-white">
                 <span>{city.flag}</span> {city.name}
               </p>
               <p className="text-xs text-white/70">
                 {city.country} · {city.onlineCount.toLocaleString()} online
               </p>
             </div>
           </button>
         ))}
       </div>
     )}

     {/* Travel Mode Banner */}
     <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
       <div className="flex items-center gap-4">
         <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
           <MapPin className="h-5 w-5 text-purple-400" />
         </div>
         <div className="flex-1">
           <p className="text-sm font-semibold text-white">
             Traveling to {selectedCityData?.name ?? selectedCity}? Turn on travel mode.
           </p>
           <p className="text-xs text-white/60">
             You appear in {selectedCityData?.name ?? selectedCity} from{" "}
             {user?.tier !== "free" ? "14 days" : "3 days"} before arrival. Approximate location only.
           </p>
         </div>
         <button
           onClick={() => toggleTravelMode.mutate()}
           disabled={toggleTravelMode.isPending}
           className={cn(
             "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
             travelMode
               ? "bg-purple-500 text-white hover:bg-purple-400"
               : "border border-white/20 bg-transparent text-white hover:bg-white/10"
           )}
         >
           {travelMode ? "Turn off" : "Turn on travel mode"}
         </button>
       </div>
     </div>

     {/* Filters */}
     <div className="mb-4 flex flex-wrap gap-2">
       {FILTERS.map((filter) => {
         const Icon = filter.icon;
         const isActive = activeFilters.has(filter.id);
         return (
           <button
             key={filter.id}
             onClick={() => toggleFilter(filter.id)}
             className={cn(
               "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
               isActive
                 ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
                 : "border-white/20 bg-white/5 text-white/60 hover:text-white"
             )}
           >
             <Icon className="h-4 w-4" />
             {filter.label}
           </button>
         );
       })}
     </div>

     {/* Results Bar */}
     <div className="mb-4 flex items-center justify-between">
       <p className="text-sm text-white/60">
         {profilesList.length} {profilesList.length === 1 ? "guy" : "guys"} nearby
       </p>
       <div className="flex items-center gap-3">
         {/* Layout Toggle */}
         <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
           <button
             onClick={() => setLayout("list")}
             className={cn(
               "rounded-md px-2 py-1 text-xs transition-colors",
               layout === "list" ? "bg-white/10 text-white" : "text-white/40"
             )}
           >
             ☰
           </button>
           <button
             onClick={() => setLayout("grid")}
             className={cn(
               "rounded-md px-2 py-1 text-xs transition-colors",
               layout === "grid" ? "bg-white/10 text-white" : "text-white/40"
             )}
           >
             ⊞
           </button>
         </div>

         {/* Sort */}
         <div className="relative">
           <select
             value={sort}
             onChange={(e) => setSort(e.target.value as SortKey)}
             className="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-8 text-sm text-white focus:border-yellow-500/50 focus:outline-none"
           >
             {SORT_OPTIONS.map((opt) => (
               <option key={opt.value} value={opt.value}>
                 Sort: {opt.label}
               </option>
             ))}
           </select>
           <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
         </div>
       </div>
     </div>

     {/* Profiles Grid */}
     {profilesLoading ? (
       <div className={cn(
         "gap-4",
         layout === "grid"
           ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
           : "flex flex-col"
       )}>
         {Array.from({ length: 10 }).map((_, i) => (
           <Skeleton key={i} className={cn("rounded-2xl", layout === "grid" ? "h-72" : "h-20")} />
         ))}
       </div>
     ) : profilesList.length === 0 ? (
       <EmptyState
         title={`No one in ${selectedCityData?.name ?? selectedCity} matches your search`}
         description="Try clearing your filters — new kings land every day."
       />
     ) : layout === "grid" ? (
       <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
         {profilesList.map((profile, i) => (
           <div
             key={profile.id}
             className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20"
             style={{ animationDelay: `${Math.min(i * 40, 420)}ms` }}
           >
             {/* Activity Badge */}
             {profile.activity && (
               <div className="absolute left-3 top-3 z-10">
                 <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                   {profile.activity}
                 </span>
               </div>
             )}

             {/* Online Indicator */}
             {profile.status === "online" && (
               <div className="absolute right-3 top-3 z-10">
                 <span className="h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/30" />
               </div>
             )}

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
                   {profile.verified ? "Verified" : profile.status === "online" ? "Online now" : "Active this week"}
                 </p>
               </div>
             </div>

             {/* Tags */}
             <div className="p-3">
               <div className="flex flex-wrap gap-1.5">
                 {profile.tags.slice(0, 3).map((tag) => (
                   <span
                     key={tag}
                     className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
                   >
                     {tag}
                   </span>
                 ))}
               </div>
             </div>
           </div>
         ))}
       </div>
     ) : (
       <div className="flex flex-col gap-2">
         {profilesList.map((profile) => (
           <div
             key={profile.id}
             className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20"
           >
             {/* Photo */}
             <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
               <img
                 src={profile.photo}
                 alt={`${profile.name}, ${profile.age}`}
                 className="h-full w-full object-cover"
               />
               {profile.status === "online" && (
                 <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/30" />
               )}
             </div>

             {/* Info */}
             <div className="min-w-0 flex-1">
               <p className="font-semibold text-white">{profile.name}, {profile.age}</p>
               <p className="text-sm text-white/60">
                 {profile.distance} mi ·{" "}
                 {profile.verified ? "Verified" : profile.status === "online" ? "Online now" : "Active this week"}
                 {profile.hosting ? " · Hosting" : ""}
               </p>
             </div>

             {/* Tags */}
             <div className="hidden flex-wrap gap-1.5 sm:flex">
               {profile.tags.slice(0, 2).map((tag) => (
                 <span
                   key={tag}
                   className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
                 >
                   {tag}
                 </span>
               ))}
             </div>
           </div>
         ))}
       </div>
     )}
   </div>
 );
}
