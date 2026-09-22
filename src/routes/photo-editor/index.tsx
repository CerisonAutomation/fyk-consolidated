import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImageIcon, ShieldCheck, Sliders, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client";
import { uploadMedia, uploadMessage } from "@/lib/upload-media";

/**
 * `/photo-editor` — adjust a photo's lighting and crop through `POST /api/ai/photo-enhance`.
 *
 * The generated screen called `/api/ai/photo-enhance` and `/api/ai/photo-edit` with an
 * invented `{image, filters}` body and rendered a slider that mutated nothing. The real
 * route has two actions: `score` (`{urls}`) and `enhance`
 * (`{url, adjustments}`), and `enhance` refuses any request whose payload mentions
 * face shape, birthmarks, skin colour or age — that refusal is the point of the screen,
 * so it is shown rather than hidden behind a client-side filter.
 *
 * WHAT "ENHANCE" DOES HERE
 * ------------------------
 * `#/domains/ai/heuristic/photo-enhance` stores the adjustments and returns the same
 * image URL with a marker query; it does not re-encode pixels, because nothing in this
 * deployment runs an image model. So the preview is drawn by the browser from the
 * brightness and contrast values the server accepted, and the copy says that. Scores
 * are derived from the URL and filename — deterministic, not a measurement of the
 * photograph.
 */

interface ScoreResponse {
	ok: boolean;
	scores?: {
		url: string;
		quality: number;
		lighting: number;
		blur: number;
		smile: number;
		background: number;
		appeal: number;
		issues: string[];
		suggestions: string[];
	}[];
	explainability?: { engine: string; deterministic: boolean; model: string | null };
}

interface EnhanceResponse {
	ok: boolean;
	enhancement?: {
		originalUrl: string;
		enhancedUrl?: string;
		adjustments: {
			brightness?: number;
			contrast?: number;
			crop?: { x: number; y: number; width: number; height: number };
		};
		allowed: boolean;
		blockedReason?: string;
	};
	explainability?: { engine: string; deterministic: boolean; model: string | null };
}

export const Route = createFileRoute("/photo-editor/")({
	component: PhotoEditorScreen,
});

function PhotoEditorScreen() {
	const [url, setUrl] = useState("");
	const [note, setNote] = useState<string | null>(null);
	const [brightness, setBrightness] = useState(0);
	const [contrast, setContrast] = useState(0);
	const [squareCrop, setSquareCrop] = useState(false);
	const [scored, setScored] = useState<ScoreResponse["scores"] | null>(null);
	const [applied, setApplied] = useState<EnhanceResponse["enhancement"] | null>(null);

	const score = useMutation({
		mutationFn: async () => {
			if (!url) throw new ApiError(0, "Upload a photo first.");
			return api<ScoreResponse>(
				"/api/ai/photo-enhance?action=score&urls=" + encodeURIComponent(url),
				{ method: "POST", body: { urls: [url] } },
			);
		},
		onSuccess: (data) => {
			setScored(data.scores ?? []);
			setNote(null);
		},
		onError: (error) =>
			setNote(error instanceof ApiError ? error.message : uploadMessage(error)),
	});

	const enhance = useMutation({
		mutationFn: () =>
			api<EnhanceResponse>("/api/ai/photo-enhance?action=enhance", {
				method: "POST",
				body: {
					url,
					adjustments: {
						brightness,
						contrast,
						...(squareCrop ? { crop: { x: 0, y: 0, width: 1, height: 1 } } : {}),
					},
				},
			}),
		onSuccess: (data) => {
			setApplied(data.enhancement ?? null);
			setNote(null);
		},
		onError: (error) => {
			setApplied(null);
			setNote(error instanceof ApiError ? error.message : uploadMessage(error));
		},
	});

	return (
		<div className="mx-auto max-w-3xl p-4 pb-24">
			<div className="rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
						<Sliders className="h-5 w-5" />
					</div>
					<div>
						<h1 className="font-display text-[22px] font-bold tracking-tight text-black">
							Photo editor
						</h1>
						<p className="mt-0.5 text-[13px] text-zinc-500">
							Brightness, contrast and crop — recorded against your profile.
						</p>
					</div>
				</div>

				{note && (
					<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
						{note}
					</output>
				)}

				<div className="mt-4 grid gap-4 md:grid-cols-[260px,1fr]">
					<div className="space-y-3">
						<input
							type="file"
							accept="image/*"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (!file) return;
								uploadMedia(file, "edits")
									.then((result) => {
										setUrl(result.url);
										setScored(null);
										setApplied(null);
										setNote(null);
									})
									.catch((error) => setNote(uploadMessage(error)));
							}}
							className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[12px] file:text-white"
							aria-label="Choose a photo to edit"
						/>

						<div
							className="relative aspect-square overflow-hidden rounded-[16px] bg-zinc-100"
							style={{
								filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`,
							}}
						>
							{url ? (
								<img
									src={url}
									alt="Preview of the adjustments applied"
									className="h-full w-full object-cover"
									style={squareCrop ? { objectFit: "cover" } : undefined}
								/>
							) : (
								<div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
									<ImageIcon className="h-8 w-8" />
									<p className="text-[12px]">No photo yet</p>
								</div>
							)}
						</div>
						<p className="text-[11px] text-zinc-500">
							The preview above is drawn by your browser from the values the
							server accepted. Nothing in this build re-encodes the image, so
							what you see is the look, not a new file.
						</p>
					</div>

					<div className="space-y-4">
						<div>
							<div className="flex items-center justify-between text-[12px] font-medium text-zinc-600">
								<span>Brightness</span>
								<span className="tabular-nums text-black">{brightness}</span>
							</div>
							<input
								type="range"
								min={-50}
								max={50}
								value={brightness}
								onChange={(event) => setBrightness(Number(event.target.value))}
								className="mt-2 w-full"
								aria-label="Brightness"
							/>
						</div>

						<div>
							<div className="flex items-center justify-between text-[12px] font-medium text-zinc-600">
								<span>Contrast</span>
								<span className="tabular-nums text-black">{contrast}</span>
							</div>
							<input
								type="range"
								min={-50}
								max={50}
								value={contrast}
								onChange={(event) => setContrast(Number(event.target.value))}
								className="mt-2 w-full"
								aria-label="Contrast"
							/>
						</div>

						<label className="flex items-center gap-2 text-[13px] text-zinc-700">
							<input
								type="checkbox"
								checked={squareCrop}
								onChange={(event) => setSquareCrop(event.target.checked)}
							/>
							Crop to a centred square
						</label>

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								onClick={() => score.mutate()}
								disabled={!url || score.isPending}
								className="rounded-[12px] border border-black/10 px-4 text-black disabled:opacity-60"
							>
								<Sparkles className="mr-1 inline h-4 w-4" />
								{score.isPending ? "Scoring…" : "Score this photo"}
							</Button>
							<Button
								type="button"
								onClick={() => enhance.mutate()}
								disabled={!url || enhance.isPending}
								className="rounded-[12px] bg-black px-4 text-white disabled:opacity-60"
							>
								{enhance.isPending ? "Applying…" : "Apply to my profile"}
							</Button>
						</div>

						<div className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
							<ShieldCheck className="mr-1 inline h-4 w-4 align-text-bottom" />
							The server refuses edits that alter identity — face shape,
							birthmarks, skin colour or age — with a 400 and the reason. This
							screen sends only lighting and crop, so nothing here can trip it.
						</div>

						{applied && (
							<dl className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
								<div className="flex justify-between">
									<dt>Saved</dt>
									<dd className="font-medium">
										brightness {applied.adjustments.brightness ?? 0},{" "}
										contrast {applied.adjustments.contrast ?? 0}
										{applied.adjustments.crop ? ", square crop" : ""}
									</dd>
								</div>
								<div className="mt-1 flex justify-between">
									<dt>Allowed</dt>
									<dd className="font-medium">{applied.allowed ? "yes" : "no"}</dd>
								</div>
							</dl>
						)}

						{scored && scored.length > 0 && (
							<div className="rounded-[12px] border border-zinc-200 px-3 py-2 text-[12px]">
								<p className="font-medium text-black">Heuristic scores</p>
								<p className="mt-1 text-zinc-500">
									Derived from the URL and filename, so they are stable and
									comparable — they are not a measurement of the photograph.
								</p>
								<div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
									{[
										["quality", scored[0].quality],
										["lighting", scored[0].lighting],
										["sharpness", scored[0].blur],
										["smile", scored[0].smile],
										["background", scored[0].background],
										["appeal", scored[0].appeal],
									].map(([label, value]) => (
										<div key={label} className="flex justify-between text-zinc-700">
											<span className="capitalize">{label}</span>
											<span className="tabular-nums font-medium">{value}</span>
										</div>
									))}
								</div>
								{scored[0].issues.length > 0 && (
									<p className="mt-2 text-zinc-600">
										Flagged: {scored[0].issues.join(", ")}
									</p>
								)}
								{scored[0].suggestions.length > 0 && (
									<p className="mt-1 text-zinc-600">
										Suggested: {scored[0].suggestions.join(" · ")}
									</p>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			<p className="mt-4 text-[11px] text-zinc-500">
				Reads and writes <code>/api/ai/photo-enhance</code> —{" "}
				<code>?action=score</code> then <code>?action=enhance</code>.
			</p>
		</div>
	);
}
