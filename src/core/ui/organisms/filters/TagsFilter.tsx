import {
	useState,
	useEffect,
	useMemo,
	useCallback,
	type ReactNode,
} from "react";
import { FilterDropdown } from "./FilterDropdown";

interface TagItem {
	tagId: string;
	text: string;
}

interface TagCategory {
	text: string;
	tags: TagItem[];
}

interface TagsFilterProps {
	checked: boolean;
	onChangeChecked: (checked: boolean) => void;
	value: string[];
	onChangeValue: (value: string[]) => void;
	/** Function to fetch tags - should return Promise resolving to categories */
	fetchTags?: () => Promise<TagCategory[]>;
}

const MAX_SEARCH_RESULTS = 50;
const SEARCH_DEBOUNCE_MS = 50;

export function TagsFilter({
	checked,
	onChangeChecked,
	value,
	onChangeValue,
	fetchTags,
}: TagsFilterProps): ReactNode {
	const [searchQuery, setSearchQuery] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [query, setQuery] = useState("");
	const [categories, setCategories] = useState<TagCategory[]>([]);
	const [flat, setFlat] = useState<(TagItem & { textLower: string })[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	// Debounce search
	useEffect(() => {
		const next = searchQuery.trim().toLowerCase();
		const timeout = setTimeout(() => setQuery(next), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [searchQuery]);

	// Load tags
	useEffect(() => {
		if (!fetchTags) {
			setLoading(false);
			return;
		}
		fetchTags()
			.then((langs) => {
				const flatList: (TagItem & { textLower: string })[] = [];
				const seenText = new Set<string>();
				for (const category of langs) {
					for (const tag of category.tags) {
						const textLower = tag.text.toLowerCase();
						if (!seenText.has(textLower)) {
							seenText.add(textLower);
							flatList.push({ ...tag, textLower });
						}
					}
				}
				setCategories(langs);
				setFlat(flatList.sort((a, b) => a.text.localeCompare(b.text)));
				setLoading(false);
			})
			.catch(() => {
				setError(true);
				setLoading(false);
			});
	}, [fetchTags]);

	const filtered = useMemo(() => {
		if (!query) return [];
		return flat
			.filter((t) => t.textLower.includes(query))
			.sort(
				(a, b) =>
					Number(b.textLower.startsWith(query)) -
					Number(a.textLower.startsWith(query)),
			);
	}, [query, flat]);

	const shown = useMemo(
		() => filtered.slice(0, MAX_SEARCH_RESULTS),
		[filtered],
	);

	const valueLabel = value.join(", ");

	const handleCheckedChange = useCallback(
		(newValue: boolean) => {
			onChangeChecked(newValue);
			if (!newValue) {
				onChangeValue([]);
			}
		},
		[onChangeChecked, onChangeValue],
	);

	const handleToggleTag = useCallback(
		(tagText: string) => {
			const isSelected = value.includes(tagText);
			let newValue: string[];
			if (isSelected) {
				newValue = value.filter((v) => v !== tagText);
			} else {
				newValue = [...value, tagText];
			}
			onChangeValue(newValue);
			onChangeChecked(newValue.length > 0);
		},
		[value, onChangeValue, onChangeChecked],
	);

	if (error) {
		return <div className="text-sm text-destructive">Failed to load tags</div>;
	}

	return (
		<FilterDropdown
			id="tags"
			label="Tags"
			checked={checked}
			onChangeChecked={handleCheckedChange}
			endLabel={
				value.length > 5 || valueLabel.length > 20
					? `${value.length} selected`
					: valueLabel
			}
		>
			<div className="flex min-w-0 flex-col">
				<div className="w-full pe-1">
					<input
						id="search-tags"
						type="search"
						placeholder="Search tags..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
					/>
				</div>

				{loading ? (
					<div className="flex justify-center py-4 text-sm text-muted-foreground">
						Loading...
					</div>
				) : (
					<>
						<div className="flex flex-wrap gap-1">
							{query ? (
								shown.length > 0 ? (
									<>
										{shown.map((tag) => {
											const isSelected = value.includes(tag.text);
											return (
												<button
													key={tag.tagId}
													type="button"
													onClick={() => handleToggleTag(tag.text)}
													className={`inline-flex items-center rounded-md border px-3 py-1 text-xs transition-colors ${
														isSelected
															? "border-primary bg-primary text-primary-foreground"
															: "border-border bg-background text-foreground hover:bg-muted"
													}`}
												>
													{tag.text}
												</button>
											);
										})}
										{filtered.length > shown.length && (
											<div className="w-full py-2 text-center text-xs text-muted-foreground">
												Showing first {shown.length} of {filtered.length}{" "}
												matches, keep typing to narrow down
											</div>
										)}
									</>
								) : (
									<div className="w-full py-2 text-center text-xs text-muted-foreground">
										No tags match &quot;{searchQuery}&quot;
									</div>
								)
							) : (
								<>
									{categories.map((category, catIndex) => {
										if (category.tags.length === 0) return null;
										if (!expanded && catIndex >= 2) return null;
										return (
											<div key={category.text} className="w-full">
												<div className="mt-1.5 mb-1 w-full px-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
													{category.text}
												</div>
												<div className="flex flex-wrap gap-1">
													{category.tags.map((tag) => {
														const isSelected = value.includes(tag.text);
														return (
															<button
																key={tag.tagId}
																type="button"
																onClick={() => handleToggleTag(tag.text)}
																className={`inline-flex items-center rounded-md border px-3 py-1 text-xs transition-colors ${
																	isSelected
																		? "border-primary bg-primary text-primary-foreground"
																		: "border-border bg-background text-foreground hover:bg-muted"
																}`}
															>
																{tag.text}
															</button>
														);
													})}
												</div>
											</div>
										);
									})}
								</>
							)}
						</div>

						{!query && (
							<button
								type="button"
								onClick={() => setExpanded(!expanded)}
								className="mt-2 w-fit inline-flex items-center rounded-md border border-secondary bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
							>
								{expanded ? "Less" : "More"}
							</button>
						)}
					</>
				)}
			</div>
		</FilterDropdown>
	);
}
