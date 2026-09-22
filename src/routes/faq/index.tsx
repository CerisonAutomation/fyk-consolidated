import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
	FAQ_CATEGORIES,
	FAQ_CATEGORY_LABELS,
	FAQ_ENTRIES,
	type FaqCategory,
	searchFaq,
} from "@/lib/faq-content";
import { cn } from "@/lib/utils";

/**
 * `/faq` — help text, read from this build rather than from a route.
 *
 * The generated screen fetched `/api/faq` and posted to `/api/faq/{id}/action`. Neither
 * exists, and neither should: help is content that ships with the app, not a resource
 * that changes per request. Behind an endpoint the answers would also disappear whenever
 * the API is down — which is when somebody is most likely to be looking for them.
 *
 * `#/lib/faq-content` holds the entries; every answer names the screen or migration that
 * does the thing it describes, so it can be checked rather than believed.
 */
export const Route = createFileRoute("/faq/")({
	component: FaqScreen,
});

function FaqScreen() {
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<FaqCategory | "all">("all");

	const results = useMemo(() => searchFaq(query, category), [query, category]);

	return (
		<div className="mx-auto max-w-2xl p-4 pb-24">
			<h1 className="font-display text-[24px] font-bold tracking-tight text-black">
				Help
			</h1>
			<p className="mt-1 text-[14px] text-zinc-500">
				{FAQ_ENTRIES.length} answers, each naming the screen or table behind it.
			</p>

			<div className="mt-4 flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
				<Search className="h-3.5 w-3.5 text-zinc-400" />
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search help…"
					aria-label="Search help"
					className="w-full bg-transparent text-[13px] outline-none"
				/>
			</div>

			<div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
				{(["all", ...FAQ_CATEGORIES] as const).map((name) => (
					<button
						key={name}
						type="button"
						onClick={() => setCategory(name)}
						className={cn(
							"shrink-0 rounded-full border px-3 py-1.5 text-[13px]",
							category === name
								? "border-black bg-black text-white"
								: "border-zinc-200 bg-white text-zinc-600",
						)}
					>
						{name === "all" ? "All" : FAQ_CATEGORY_LABELS[name]}
					</button>
				))}
			</div>

			{results.length === 0 ? (
				<div className="mt-6 rounded-[16px] border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
					<p className="text-[14px] font-medium text-zinc-700">Nothing matched</p>
					<p className="mt-1 text-[12px] text-zinc-500">
						Try a shorter word, or clear the category filter.
					</p>
				</div>
			) : (
				<div className="mt-6 space-y-3">
					{results.map((entry) => (
						<details
							key={entry.id}
							className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm"
						>
							<summary className="cursor-pointer text-[14px] font-medium text-black">
								{entry.question}
							</summary>
							<p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
								{entry.answer}
							</p>
							{entry.to && (
								<p className="mt-2 text-[12px]">
									<Link to={entry.to} className="underline">
										Open it
									</Link>
								</p>
							)}
							<p className="mt-2 text-[11px] text-zinc-400">
								{FAQ_CATEGORY_LABELS[entry.category]}
							</p>
						</details>
					))}
				</div>
			)}
		</div>
	);
}
