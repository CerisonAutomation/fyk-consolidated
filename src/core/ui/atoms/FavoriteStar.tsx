import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "../cn";

interface FavoriteStarProps {
	className?: string;
}

export function FavoriteStar({ className }: FavoriteStarProps): ReactNode {
	return (
		<>
			<Star
				data-slot="favorite-star"
				className={cn(
					"size-3.5 shrink-0 -translate-y-px text-yellow-500",
					className,
				)}
				fill="currentColor"
				strokeWidth={0}
			/>
			<span className="sr-only">Favorite</span>
		</>
	);
}
