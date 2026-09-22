import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Images, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client";
import { uploadMedia, uploadMessage } from "@/lib/upload-media";

/**
 * `/ai/photo-ranker` — rank the photos on a profile through `POST /api/ai`.
 *
 * The generated screen fetched `/api/ai/photo-ranker` as a list and posted to
 * `/api/ai/photo-ranker/{id}/action`. Neither exists: ranking is one call with the
 * photo URLs in it, answered by the `photoRanker` action of `#/routes/api/ai`.
 *
 * WHAT THE SCORE IS, SAID PLAINLY
 * -------------------------------
 * `#/domains/ai/heuristic/photo-rank` scores from signals in the URL and filename —
 * `selfie`, `sunset`, `blur`, `sunglasses` — with a hash of the URL as the
 * tie-breaker. There is no vision model in this deployment, so a file called
 * `IMG_1234.jpg` scores a neutral 50 with no tags, and the screen says that rather
 * than presenting the number as though the image had been looked at. It is
 * deterministic: the same list ranks the same way every time, which is what makes the
 * ordering worth acting on.
 */

interface RankedPhoto {
	url: string;
	score: number;
	tags: string[];
}

interface MeResponse {
	profile?: { photos?: string[] } | null;
}

const MAX_PHOTOS = 12;

export const Route = createFileRoute("/ai/photo-ranker/")({
	component: PhotoRankerScreen,
});

function PhotoRankerScreen() {
	const [extra, setExtra] = useState<string[]>([]);
	const [note, setNote] = useState<string | null>(null);
	const [pendingFile, setPendingFile] = useState<File | null>(null);

	const me = useQuery({
		queryKey: ["photo-ranker", "me"],
		queryFn: () => api<MeResponse>("/api/auth/me"),
	});

	const photos = [
		...(me.data?.profile?.photos ?? []).filter((url): url is string => typeof url === "string"),
		...extra,
	].slice(0, MAX_PHOTOS);

	const rank = useMutation({
		mutationFn: async () => {
			const file = pendingFile;
			const uploaded = file ? (await uploadMedia(file, "photos")).url : null;
			const list = uploaded ? [...photos, uploaded] : photos;
			if (list.length === 0)
				throw new ApiError(0, "Add at least one photo to rank.");
			if (uploaded) setExtra((prev) => [...prev, uploaded]);
			return api<{ ranked: RankedPhoto[] }>("/api/ai", {
				method: "POST",
				body: { action: "photoRanker", photos: list },
			});
		},
		onSuccess: () => setNote(null),
		onError: (error) =>
			setNote(error instanceof ApiError ? error.message : uploadMessage(error)),
	});

	return (
		<div className="mx-auto max-w-2xl p-4 pb-24">
			<div className="rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
						<Images className="h-5 w-5" />
					</div>
					<div>
						<h1 className="font-display text-[22px] font-bold tracking-tight text-black">
							Photo ranker
						</h1>
						<p className="mt-0.5 text-[13px] text-zinc-500">
							{photos.length} of {MAX_PHOTOS} photos ready to rank.
						</p>
					</div>
				</div>

				<p className="mt-4 rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
					Scores come from the filename and URL — words like <code>selfie</code>,{" "}
					<code>sunset</code>, <code>blur</code> — not from looking at the image.
					There is no vision model in this build. A file named{" "}
					<code>IMG_1234.jpg</code> scores a neutral 50 with no tags, and the order
					is the same every time you ask.
				</p>

				{note && (
					<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
						{note}
					</output>
				)}

				<div className="mt-4 flex flex-wrap items-center gap-2">
					<input
						type="file"
						accept="image/*"
						onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)}
						className="rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[12px] file:text-white"
						aria-label="Add a photo to rank"
					/>
					<Button
						type="button"
						onClick={() => rank.mutate()}
						disabled={rank.isPending || photos.length === 0}
						className="rounded-[12px] bg-black px-4 text-white disabled:opacity-60"
					>
						<Sparkles className="mr-1 inline h-4 w-4" />
						{rank.isPending ? "Ranking…" : "Rank these photos"}
					</Button>
				</div>

				{photos.length === 0 && (
					<p className="mt-4 text-[13px] text-zinc-500">
						No photos on the profile yet. Add one above, or upload them from{" "}
						<a className="underline" href="/settings/profile">
							profile settings
						</a>
						.
					</p>
				)}
			</div>

			{rank.data?.ranked && rank.data.ranked.length > 0 && (
				<div className="mt-4 space-y-3">
					{rank.data.ranked.map((photo, index) => (
						<div
							key={photo.url}
							className="flex items-center gap-4 rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm"
						>
							<span className="font-display w-6 text-[18px] font-bold text-zinc-400">
								{index + 1}
							</span>
							<img
								src={photo.url}
								alt=""
								className="h-16 w-16 shrink-0 rounded-[12px] object-cover"
							/>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
										<div
											className="h-full rounded-full bg-black"
											style={{ width: `${Math.max(0, Math.min(100, photo.score))}%` }}
										/>
									</div>
									<span className="text-[13px] font-medium text-black">
										{photo.score}
									</span>
								</div>
								<div className="mt-2 flex flex-wrap gap-1.5">
									{photo.tags.length === 0 && (
										<span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
											no signals in the filename
										</span>
									)}
									{photo.tags.map((tag) => (
										<span
											key={tag}
											className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600"
										>
											{tag}
										</span>
									))}
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			<p className="mt-4 text-[11px] text-zinc-500">
				Reads <code>/api/auth/me</code> for the current photos and writes{" "}
				<code>POST /api/ai</code> with <code>action: "photoRanker"</code>.
			</p>
		</div>
	);
}
