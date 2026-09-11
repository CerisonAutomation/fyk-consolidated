import { Link } from "@tanstack/react-router";
import { Crown, Bell, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserDropdown } from "#/components/UserDropdown";
import { MapSearchBar } from "#/components/map/MapSearchBar";
import { api } from "#/lib/client";
import { cn } from "#/utils/cn";

interface Notification {
 id: string;
 icon: "match" | "event" | "visit" | "like";
 text: string;
 time: string;
 read: boolean;
}

/**
 * Glass-blur header bar with search, notifications dropdown, and profile actions.
 */
export default function Header() {
 const [searchQuery, setSearchQuery] = useState("");
 const [notificationsOpen, setNotificationsOpen] = useState(false);

 const { data: notifications } = useQuery({
   queryKey: ["notifications"],
   queryFn: () => api<{ notifications: Notification[] }>("/api/notifications").then((r) => r.notifications),
   refetchInterval: 30000,
 });

 const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

 useEffect(() => {
   function handleClickOutside(e: MouseEvent) {
     if (notificationsOpen && !(e.target as Element)?.closest("[data-notifications]")) {
       setNotificationsOpen(false);
     }
   }
   document.addEventListener("mousedown", handleClickOutside);
   return () => document.removeEventListener("mousedown", handleClickOutside);
 }, [notificationsOpen]);

 const getIcon = (icon: Notification["icon"]) => {
   switch (icon) {
     case "match": return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400">✨</span>;
     case "event": return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">📅</span>;
     case "visit": return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60">👁</span>;
     case "like": return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">❤️</span>;
   }
 };

 return (
   <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-black/40 backdrop-blur-2xl">
     <nav className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
       {/* Logo / Brand */}
       <Link
         to="/"
         className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white no-underline transition-opacity hover:opacity-80"
       >
         <span className="inline-flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-yellow-400 to-amber-600 text-[10px] font-bold text-black">
           FK
         </span>
         <span className="hidden font-[family-name:var(--font-bebas-neue)] text-lg tracking-wider sm:inline">
           FYK
         </span>
       </Link>

      {/* Search Bar — name/interest + location autocomplete */}
      <div className="hidden flex-1 justify-center lg:flex">
        <div className="relative w-full max-w-md">
          <MapSearchBar
            placeholder="Search by name, interest, or place..."
            onSelect={(f) => {
              setSearchQuery(f.name);
              // Could navigate to explore with the selected location
            }}
            className="w-full"
          />
        </div>
      </div>

       {/* Right-side actions */}
       <div className="flex items-center gap-2">
         {/* Mobile Search */}
         <Link
           to="/discover"
           className="flex size-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white lg:hidden"
         >
           <Search className="size-[18px]" />
         </Link>

         {/* Notifications Dropdown */}
         <div className="relative" data-notifications>
           <button
             onClick={() => setNotificationsOpen(!notificationsOpen)}
             className="relative flex size-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
           >
             <Bell className="size-[18px]" />
             {unreadCount > 0 && (
               <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-black/40" />
             )}
           </button>

           {notificationsOpen && (
             <>
               <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
               <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-gray-900 shadow-2xl">
                 <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                   <span className="text-sm font-semibold text-white">Notifications</span>
                   <button className="text-xs font-semibold text-yellow-400 hover:underline">
                     Mark all read
                   </button>
                 </div>
                 <div className="max-h-80 overflow-y-auto">
                   {notifications?.map((notif) => (
                     <div
                       key={notif.id}
                       className={cn(
                         "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5",
                         !notif.read && "bg-white/5"
                       )}
                     >
                       {getIcon(notif.icon)}
                       <div className="min-w-0 flex-1">
                         <p className="text-sm text-white">{notif.text}</p>
                         <p className="mt-0.5 text-xs text-white/40">{notif.time} ago</p>
                       </div>
                       {!notif.read && (
                         <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                       )}
                     </div>
                   ))}
                   {(!notifications || notifications.length === 0) && (
                     <div className="px-4 py-8 text-center text-sm text-white/40">
                       No notifications yet
                     </div>
                   )}
                 </div>
               </div>
             </>
           )}
         </div>

         <Link
           to="/premium"
           className="flex size-9 items-center justify-center rounded-xl text-yellow-400/70 transition-colors hover:bg-yellow-400/10 hover:text-yellow-400"
         >
           <Crown className="size-[18px]" />
         </Link>

         <UserDropdown />
       </div>
     </nav>
   </header>
 );
}
