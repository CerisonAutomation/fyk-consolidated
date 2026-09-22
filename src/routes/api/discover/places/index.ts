import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";

const VENUES = [
  { id: "1", name: "The Eagle", type: "bar", lat: 40.7128, lng: -74.006, address: "NYC", activeUsers: 12, tags: ["leather", "bear"] },
  { id: "2", name: "Gym Box", type: "gym", lat: 40.713, lng: -74.005, address: "NYC", activeUsers: 8, tags: ["gym", "jock"] },
  { id: "3", name: "Central Park", type: "park", lat: 40.7829, lng: -73.9654, address: "NYC", activeUsers: 25, tags: ["outdoors", "cruising"] },
  { id: "4", name: "Café Grumpy", type: "cafe", lat: 40.714, lng: -74.007, address: "NYC", activeUsers: 5, tags: ["coffee", "casual"] },
  { id: "5", name: "Club Cumming", type: "club", lat: 40.715, lng: -74.008, address: "NYC", activeUsers: 18, tags: ["nightlife", "dance"] },
];

export const Route = createFileRoute("/api/discover/places/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ request, caller }) => {
          requireCaller(caller);
          const url = new URL(request.url);
          const lat = Number(url.searchParams.get("lat"));
          const lng = Number(url.searchParams.get("lng"));
          const type = url.searchParams.get("type");
          const search = url.searchParams.get("q")?.toLowerCase();

          let venues = [...VENUES];

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            venues = venues
              .map((v) => ({
                ...v,
                distanceKm: Math.sqrt((v.lat - lat) ** 2 + (v.lng - lng) ** 2) * 111,
              }))
              .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
          }

          if (type) {
            venues = venues.filter((v) => v.type === type);
          }

          if (search) {
            venues = venues.filter((v) => v.name.toLowerCase().includes(search) || v.tags.some((t) => t.includes(search)));
          }

          const venuesWithUsers = venues.map((v) => ({
            ...v,
            checkedInUsers: [],
            isCheckedIn: false,
          }));

          return json({
            venues: venuesWithUsers,
            count: venuesWithUsers.length,
            types: [...new Set(VENUES.map((v) => v.type))],
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `places:${caller?.id}` } },
      ),
    },
  },
});
