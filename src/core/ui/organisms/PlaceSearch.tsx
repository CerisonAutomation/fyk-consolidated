import {
	useState,
	useCallback,
	useRef,
	useEffect,
	type ReactNode,
} from "react";
import { cn } from "../cn";

interface Place {
	name: string;
	address: string;
	lat: number;
	lon: number;
	importance: number;
}

interface PlaceSearchProps {
	onPick: (place: { lat: number; lon: number }) => void;
	/** Search function - receives query, returns places */
	searchPlaces?: (query: string) => Promise<Place[]>;
	clearsLocateButton?: boolean;
	className?: string;
}

export function PlaceSearch({
	onPick,
	searchPlaces,
	clearsLocateButton = false,
	className,
}: PlaceSearchProps): ReactNode {
	const [query, setQuery] = useState("");
	const [showResults, setShowResults] = useState(false);
	const [results, setResults] = useState<Place[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	// Debounced search
	useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed || !searchPlaces) {
			setResults(null);
			return;
		}

		setLoading(true);
		setError(null);

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			searchPlaces(trimmed)
				.then((r) => {
					setResults(r);
					setLoading(false);
				})
				.catch((err) => {
					setError(err instanceof Error ? err.message : "Search failed");
					setLoading(false);
				});
		}, 300);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query, searchPlaces]);

	const handlePick = useCallback(
		(place: Place) => {
			onPick({ lat: place.lat, lon: place.lon });
			setShowResults(false);
		},
		[onPick],
	);

	const sortedResults = results
		? [...results].sort((a, b) => b.importance - a.importance)
		: [];

	return (
		<>
			<div
				className={cn(
					"absolute bottom-4 z-[1010] w-full p-2",
					clearsLocateButton && "max-w-[calc(100%-2.5rem)]",
					className,
				)}
			>
				<input
					ref={inputRef}
					id="search-place"
					type="search"
					placeholder="Search places..."
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setShowResults(e.target.value.length > 0);
					}}
					onFocus={() => {
						if (query.trim()) setShowResults(true);
					}}
					onBlur={() => {
						setTimeout(() => setShowResults(false), 200);
					}}
					maxLength={100}
					className="w-full rounded-lg border border-border bg-popover-foreground px-3 py-2 text-sm text-background shadow-md backdrop-blur-xl"
				/>
			</div>

			{showResults && (
				<div className="absolute top-0 left-0 z-[1000] size-full p-1">
					<div className="flex h-full w-full flex-col gap-2 overflow-auto rounded-md bg-popover-foreground px-1 py-3 text-popover shadow-md backdrop-blur-xl">
						{loading && (
							<div className="flex justify-center py-4 text-sm text-muted-foreground">
								Searching...
							</div>
						)}

						{error && (
							<div className="px-4 py-2 text-sm text-destructive">{error}</div>
						)}

						{!loading &&
							!error &&
							sortedResults.map((place) => (
								<button
									key={`${place.lat},${place.lon},${place.name}`}
									type="button"
									onClick={() => handlePick(place)}
									className="flex flex-col items-start justify-start gap-0 rounded-md px-2 py-1.5 text-left text-current hover:bg-white/10"
								>
									<span className="line-clamp-1 block max-w-full truncate">
										{place.name}
									</span>
									<span className="line-clamp-1 block max-w-full truncate text-sm text-popover/40">
										{place.address}
									</span>
								</button>
							))}
					</div>
				</div>
			)}
		</>
	);
}
