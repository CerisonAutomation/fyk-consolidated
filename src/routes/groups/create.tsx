import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client";
import { uploadMedia, uploadMessage } from "@/lib/upload-media";

/**
 * `/groups/create` — start a group through `#/routes/api/groups`.
 *
 * The generated screen listed groups and posted to `/api/groups/{id}/action`, a path
 * nothing serves, so the only route to a new group was a direct API call.
 *
 * Privacy is the part worth getting right in the UI, because the route enforces it
 * afterwards: `public` is listed to everyone, `private` is listed but needs approval
 * to see inside, and `secret` answers 404 to anybody who is not a member — including
 * the person trying to find it again by browsing.
 */

interface CreateResult {
	ok: boolean;
	group?: { id: string; name?: string };
}

const PRIVACY = [
	{ value: "public", label: "Public", detail: "Listed, and anyone can read it." },
	{ value: "private", label: "Private", detail: "Listed, but only members see inside." },
	{ value: "secret", label: "Secret", detail: "Not listed. Members only — it 404s for everyone else." },
] as const;

const inputClass =
	"w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black";

export const Route = createFileRoute("/groups/create")({
	component: GroupCreateScreen,
});

function GroupCreateScreen() {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [privacy, setPrivacy] = useState<(typeof PRIVACY)[number]["value"]>("public");
	const [icon, setIcon] = useState("");
	const [cover, setCover] = useState<File | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const [created, setCreated] = useState<CreateResult | null>(null);

	const create = useMutation({
		mutationFn: async () => {
			const coverUrl = cover ? (await uploadMedia(cover, "groups")).url : undefined;
			return api<CreateResult>("/api/groups", {
				method: "POST",
				body: {
					action: "create",
					name: name.trim(),
					description: description.trim() || undefined,
					privacy,
					icon: icon.trim() || undefined,
					coverUrl,
				},
			});
		},
		onSuccess: (result) => setCreated(result),
		onError: (error) =>
			setNote(error instanceof ApiError ? error.message : uploadMessage(error)),
	});

	const tooShort = name.trim().length < 3;
	const tooLong = name.trim().length > 60;

	if (created?.group?.id) {
		return (
			<div className="mx-auto max-w-md p-4 pb-24">
				<div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-6 text-center">
					<Users className="mx-auto h-8 w-8 text-emerald-700" />
					<h1 className="font-display mt-3 text-[20px] font-bold text-emerald-900">
						{created.group.name ?? "Group"} created
					</h1>
					<p className="mt-1 text-[13px] text-emerald-800">You are its owner.</p>
					<div className="mt-4 flex justify-center gap-2">
						<Link
							to="/groups/$groupId"
							params={{ groupId: created.group.id }}
							className="rounded-full bg-black px-4 py-2 text-[13px] text-white"
						>
							Open the group
						</Link>
						<Link
							to="/groups"
							className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-[13px] text-emerald-800"
						>
							All groups
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
					Create a group
				</h1>
				<p className="mt-1 text-[13px] text-zinc-500">
					A group has members, roles, its own chat and its own events.
				</p>

				{note && (
					<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
						{note}
					</output>
				)}

				<div className="mt-5 space-y-4">
					<div>
						<label className="block text-[12px] font-medium text-zinc-600" htmlFor="name">
							Name
						</label>
						<input
							id="name"
							value={name}
							maxLength={60}
							onChange={(event) => setName(event.target.value)}
							placeholder="Sliema runners"
							className={`${inputClass} mt-1`}
						/>
						<p className="mt-1 text-right text-[11px] text-zinc-400">
							{name.trim().length}/60
						</p>
					</div>

					<div>
						<label className="block text-[12px] font-medium text-zinc-600" htmlFor="description">
							What it is for
						</label>
						<textarea
							id="description"
							value={description}
							rows={3}
							maxLength={500}
							onChange={(event) => setDescription(event.target.value)}
							className={`${inputClass} mt-1`}
						/>
					</div>

					<div>
						<label className="block text-[12px] font-medium text-zinc-600" htmlFor="icon">
							Icon <span className="text-zinc-400">(a short word or emoji)</span>
						</label>
						<input
							id="icon"
							value={icon}
							maxLength={64}
							onChange={(event) => setIcon(event.target.value)}
							placeholder="🏃"
							className={`${inputClass} mt-1`}
						/>
					</div>

					<div>
						<label className="block text-[12px] font-medium text-zinc-600" htmlFor="cover">
							Cover image
						</label>
						<input
							id="cover"
							type="file"
							accept="image/*"
							onChange={(event) => setCover(event.target.files?.[0] ?? null)}
							className="mt-1 w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-[12px] file:text-white"
						/>
					</div>

					<fieldset>
						<legend className="block text-[12px] font-medium text-zinc-600">
							Who can see it
						</legend>
						<div className="mt-2 space-y-2">
							{PRIVACY.map((option) => (
								<label
									key={option.value}
									className="flex items-start gap-2 rounded-[12px] border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-700"
								>
									<input
										type="radio"
										name="privacy"
										value={option.value}
										checked={privacy === option.value}
										onChange={() => setPrivacy(option.value)}
										className="mt-0.5 h-4 w-4"
									/>
									<span>
										<span className="font-medium text-black">{option.label}</span>
										<span className="block text-[12px] text-zinc-500">
											{option.detail}
										</span>
									</span>
								</label>
							))}
						</div>
					</fieldset>

					{(tooShort || tooLong) && (
						<p className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
							{tooShort
								? "A group name needs at least 3 characters."
								: "A group name is at most 60 characters."}
						</p>
					)}

					<Button
						type="button"
						onClick={() => create.mutate()}
						disabled={create.isPending || tooShort || tooLong}
						className="w-full rounded-[12px] bg-black text-white disabled:opacity-60"
					>
						{create.isPending ? "Creating…" : "Create group"}
					</Button>
				</div>
			</div>

			<p className="mt-4 text-[11px] text-zinc-500">
				Writes <code>POST /api/groups</code> with <code>action: "create"</code>. The
				creator is inserted as <code>owner</code> in the same transaction, so a
				group never exists without one.
			</p>
		</div>
	);
}
