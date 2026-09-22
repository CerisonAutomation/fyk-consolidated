import { Link } from "@tanstack/react-router";
import { Crown, Bell, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserDropdown } from "@/components/UserDropdown";
import { MapSearchBar } from "@/components/map/MapSearchBar";
import { api } from "@/lib/client";
import { cn } from "@/utils/cn";

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
   <header className="sticky top-0 z-50 w-full border-b border-border bg-surface-nav/85 backdrop-blur-2xl">
     <nav aria-label="Main" className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
       {/* Logo / Brand */}
       <Link
         to="/"
         className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground no-underline transition-opacity hover:opacity-80"
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
              window.location.href = `/explore?city=${encodeURIComponent(f.name)}`;
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
           aria-label="Search"
           className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
         >
           <Search className="size-[18px]" aria-hidden="true" />
         </Link>

         {/* Notifications Dropdown */}
         <div className="relative" data-notifications>
           <button
             onClick={() => setNotificationsOpen(!notificationsOpen)}
             aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
             aria-expanded={notificationsOpen}
             aria-haspopup="true"
             className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
           >
             <Bell className="size-[18px]" aria-hidden="true" />
             {unreadCount > 0 && (
               <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
             )}
           </button>

           {notificationsOpen && (
             <>
               <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
               <div role="menu" aria-label="Notifications" className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
                 <div className="flex items-center justify-between border-b border-border px-4 py-3">
                   <span id="notifications-label" className="text-sm font-semibold text-popover-foreground">Notifications</span>
                   <button aria-label="Mark all notifications as read" className="text-xs font-semibold text-yellow-400 hover:underline">
                     Mark all read
                   </button>
                 </div>
                 <div className="max-h-80 overflow-y-auto">
                   {notifications?.map((notif) => (
                     <div
                       key={notif.id}
                       className={cn(
                         "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover",
                         !notif.read && "bg-surface-hover"
                       )}
                     >
                       {getIcon(notif.icon)}
                       <div className="min-w-0 flex-1">
                         <p className="text-sm text-popover-foreground">{notif.text}</p>
                         <p className="mt-0.5 text-xs text-muted-foreground">{notif.time} ago</p>
                       </div>
                       {!notif.read && (
                         <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
                       )}
                     </div>
                   ))}
                   {(!notifications || notifications.length === 0) && (
                     <div className="px-4 py-8 text-center text-sm text-muted-foreground">
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
           aria-label="Premium"
           className="flex size-9 items-center justify-center rounded-xl text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
         >
           <Crown className="size-[18px]" aria-hidden="true" />
         </Link>

         <UserDropdown />
       </div>
     </nav>
   </header>
 );
}
