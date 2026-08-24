import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// -- Schemas --

const placesResponseSchema = z.object({
	places: z.array(
		z.object({
			name: z.string(),
			address: z.string().nullable(),
			lat: z.number(),
			lon: z.number(),
			importance: z.number(),
		}),
	),
});

export type Place = z.infer<typeof placesResponseSchema>["places"][number];
export type PlacesResponse = z.infer<typeof placesResponseSchema>;

// -- Query keys --

export const placeKeys = {
	all: ["places"] as const,
	search: (query: string) => [...placeKeys.all, "search", query] as const,
};

// -- Hooks --

/**
 * Search for places by name.
 * Uses Nominatim (OpenStreetMap) geocoding API — free, no key needed.
 */
export function usePlaces(query: string | null | undefined) {
	return useQuery<PlacesResponse, Error>({
		queryKey: placeKeys.search(query ?? ""),
		queryFn: async () => {
			const params = new URLSearchParams({
				q: query!,
				format: "json",
				limit: "10",
			});
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?${params.toString()}`,
				{
					headers: {
						"User-Agent": "FYK-App/1.0",
					},
				},
			);
			const data = (await res.json()) as Array<{
				display_name: string;
				lat: string;
				lon: string;
				importance: number;
			}>;
			return {
				places: data.map((p) => ({
					name: p.display_name.split(",")[0] ?? p.display_name,
					address: p.display_name,
					lat: Number.parseFloat(p.lat),
					lon: Number.parseFloat(p.lon),
					importance: p.importance,
				})),
			};
		},
		enabled: query !== null && query !== undefined && query.length > 0,
		staleTime: 5 * 60 * 1000,
	});
}
