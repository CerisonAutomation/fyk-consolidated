import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { uploadMedia } from "@/lib/upload-media";
import { api, ApiError } from "@/lib/client";

/**
 * The selfie verification flow, once.
 *
 * Two screens needed it — `/verify` (status plus the challenge) and `/verify/photo`
 * (the capture step) — and both were generated placeholders that fetched
 * `/api/verify` and `/api/verify/photo`, neither of which exists, and posted a card
 * button to `/api/verify/{id}/action`. A verification screen that cannot submit is
 * worse than no screen: it looks like the badge was earned.
 *
 * The canonical route is `#/routes/api/profile/verification`:
 *   - `GET` answers with the current level, the trust score, a *pose challenge* and
 *     when that challenge expires — the pose is generated server-side, so the client
 *     cannot pick the one it already has a photo of;
 *   - `POST` takes `{selfieUrl, pose}` and compares the selfie against the profile
 *     photo before it raises `users.verification`.
 *
 * The upload goes to the same `media` bucket `#/routes/settings/profile` uses, under
 * a `verification/` prefix: Storage holds the bytes, the route records the decision,
 * and a browser token never writes the verification column directly.
 */

interface VerificationState {
	verified: boolean;
	verificationLevel: number;
	trustScore: number;
	challenge: { pose: string; instruction: string; expiresAt: string };
	rewards?: { coins?: number; trustBoost?: number };
}

interface SubmitResult {
	ok?: boolean;
	verified?: boolean;
	message?: string;
	faceMatch?: { confidence?: number; matched?: boolean };
	[key: string]: unknown;
}

export function SelfieVerify({ compact = false }: { compact?: boolean }) {
	const qc = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [note, setNote] = useState<string | null>(null);

	const status = useQuery({
		queryKey: ["verification"],
		queryFn: () => api<VerificationState>("/api/profile/verification"),
	});

	const submit = useMutation({
		mutationFn: async () => {
			if (!file) throw new ApiError(0, "Choose the selfie to submit first.");
			// `#/lib/upload-media` is the one place that knows the bucket, the size
			// and type limits, and how to name an object so two people uploading in
			// the same millisecond cannot collide. Shouts, groups and the photo
			// screens use it too; this component had its own copy.
			const { url } = await uploadMedia(file, "verification");
			return api<SubmitResult>("/api/profile/verification", {
				method: "POST",
				body: {
					selfieUrl: url,
					// The pose the server asked for, echoed back so it can tell a
					// fresh capture from a photo that was already on the device.
					pose: status.data?.challenge.pose,
				},
			});
		},
		onSuccess: (result) => {
			qc.invalidateQueries({ queryKey: ["verification"] });
			setNote(result.message ?? (result.verified ? "Verified." : "Submitted for review."));
			setFile(null);
		},
		onError: (error) => {
			setNote(
				error instanceof ApiError || error instanceof Error
					? error.message
					: "That did not go through. Try again.",
			);
		},
	});

	const challenge = status.data?.challenge;
	const expired = challenge
		? new Date(challenge.expiresAt).getTime() < Date.now()
		: false;

	return (
		<div className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
					<Camera className="h-5 w-5" />
				</div>
				<div>
					<h2 className="font-display text-[18px] font-bold text-black">
						Selfie verification
					</h2>
					<p className="mt-0.5 text-[12px] text-zinc-500">
						{status.data
							? `Level ${status.data.verificationLevel} • trust ${status.data.trustScore}`
							: "Loading your verification state…"}
					</p>
				</div>
			</div>

			{status.data?.verified && (
				<p className="mt-4 flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
					<ShieldCheck className="h-4 w-4" /> Verified. Submitting again re-runs the
					check against a new pose.
				</p>
			)}

			{challenge && !compact && (
				<p className="mt-4 rounded-[12px] border border-black/10 bg-zinc-50 px-3 py-2 text-[13px] text-black">
					{challenge.instruction}
					{expired && (
						<span className="mt-1 block text-[12px] text-amber-700">
							That challenge expired — reload for a new one.
						</span>
					)}
				</p>
			)}

			{note && (
				<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
					{note}
				</output>
			)}

			<div className="mt-4 space-y-3">
				<label className="block text-[12px] font-medium text-zinc-600" htmlFor="selfie">
					Selfie
				</label>
				<input
					id="selfie"
					type="file"
					accept="image/*"
					capture="user"
					onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[12px] file:text-white"
				/>
				<Button
					type="button"
					onClick={() => submit.mutate()}
					disabled={!file || submit.isPending || !challenge || expired}
					className="w-full rounded-[12px] bg-black text-white disabled:opacity-60"
				>
					{submit.isPending ? "Uploading and checking…" : "Submit selfie"}
				</Button>
				<p className="text-[11px] text-zinc-500">
					The photo is uploaded to the <code>media</code> bucket under
					<code> verification/</code> and compared with your profile photo. The
					server decides; nothing here writes the badge.
				</p>
			</div>
		</div>
	);
}
