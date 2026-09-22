import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client";
import { uploadMedia, uploadMessage } from "@/lib/upload-media";

/**
 * `/shouts/create` — post a shout through `#/routes/api/shouts`.
 *
 * The generated screen showed a grid of `/api/shouts` and posted its button to
 * `/api/shouts/{id}/action`, which nothing serves: the one thing this route is for —
 * writing a shout — was not reachable from it.
 *
 * A shout is text, media, or both, up to 500 characters; the route says so in its own
 * refinement, and the counter here reflects that limit rather than letting the submit
 * be the first place it is mentioned. Media goes to the `media` bucket through
 * `#/lib/upload-media` and the URL is what gets stored.
 */

interface CreateResult {
	ok: boolean;
	shout?: { id: string };
}

const MAX_CONTENT = 500;

export const Route = createFileRoute("/shouts/create")({
	component: ShoutCreateScreen,
});

function ShoutCreateScreen() {
	const [content, setContent] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const [created, setCreated] = useState<CreateResult | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const create = useMutation({
		mutationFn: async () => {
			const mediaUrl = file ? (await uploadMedia(file, "shouts")).url : undefined;
			return api<CreateResult>("/api/shouts", {
				method: "POST",
				body: {
					action: "create",
					content: content.trim() || undefined,
					mediaUrl,
				},
			});
		},
		onSuccess: (result) => setCreated(result),
		onError: (error) =>
			setNote(
				error instanceof ApiError
					? error.message
					: uploadMessage(error),
			),
	});

	const tooLong = content.length > MAX_CONTENT;
	const empty = content.trim().length === 0 && !file;

	if (created?.shout?.id) {
		return (
			<div className="mx-auto max-w-md p-4 pb-24">
				<div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-6 text-center">
					<Megaphone className="mx-auto h-8 w-8 text-emerald-700" />
					<h1 className="font-display mt-3 text-[20px] font-bold text-emerald-900">
						Shout posted
					</h1>
					<p className="mt-1 text-[13px] text-emerald-800">
						It is in the public feed now.
					</p>
					<div className="mt-4 flex justify-center gap-2">
						<Link
							to="/shouts/$shoutId"
							params={{ shoutId: created.shout.id }}
							className="rounded-full bg-black px-4 py-2 text-[13px] text-white"
						>
							Open it
						</Link>
						<Link
							to="/shouts"
							className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-[13px] text-emerald-800"
						>
							Feed
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-md p-4 pb-24">
			<div className="rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-sm">
				<h1 className="font-display text-[22px] font-bold tracking-tight text-black">
					Shout
				</h1>
				<p className="mt-1 text-[13px] text-zinc-500">
					Public, short-lived, and visible to everyone browsing.
				</p>

				{note && (
					<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
						{note}
					</output>
				)}

				<div className="mt-5 space-y-4">
					<textarea
						value={content}
						rows={4}
						maxLength={MAX_CONTENT}
						onChange={(event) => setContent(event.target.value)}
						placeholder="What is happening right now?"
						className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black"
						aria-label="Shout text"
					/>
					<p className="text-right text-[11px] text-zinc-400">
						{content.length}/{MAX_CONTENT}
					</p>

					<input
						ref={fileInput}
						type="file"
						accept="image/*,video/*"
						onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[12px] file:text-white"
						aria-label="Photo or video"
					/>

					{empty && (
						<p className="text-[12px] text-zinc-500">
							A shout needs text, media, or both.
						</p>
					)}

					<Button
						type="button"
						onClick={() => create.mutate()}
						disabled={create.isPending || empty || tooLong}
						className="w-full rounded-[12px] bg-black text-white disabled:opacity-60"
					>
						{create.isPending ? "Posting…" : "Post shout"}
					</Button>
				</div>
			</div>

			<p className="mt-4 text-[11px] text-zinc-500">
				Writes <code>POST /api/shouts</code> with <code>action: "create"</code>.
				Likes are counted by a trigger from the like rows, so the number on the
				card cannot drift from the taps behind it.
			</p>
		</div>
	);
}
