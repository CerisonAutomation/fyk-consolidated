import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { BadgeCheck, Camera, Check, Eye, EyeOff, ImagePlus, Loader2, LogOut, MapPin, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { z } from "zod";
import { api } from "#/lib/client";
import type { SelfSettings } from "#/lib/api-types";
import { cn, timeAgo } from "#/lib/utils";
import { Chip } from "#/components/ui/Chip";
import { MediaImage } from "#/components/ui/MediaImage";
import { StateBlock, describeFailure } from "#/components/ui/StateBlock";
import { Switch } from "#/components/ui/Switch";
import { useShell } from "#/components/AppShell";
import { useToasts } from "#/lib/toast";

export const Route = createFileRoute("/settings/")({
	component: SettingsPage,
	head: () => ({ meta: [{ title: "Settings — FYK" }] }),
});

const profileSchema = z.object({
	displayName: z.string().trim().min(2, "Use at least 2 characters.").max(40),
	handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "3-24 letters, numbers or underscores."),
	headline: z.string().trim().max(120).optional(),
	bio: z.string().trim().max(1000).optional(),
	city: z.string().trim().max(80).optional(),
	interests: z.array(z.string()).max(15),
	lookingFor: z.array(z.string()).max(6),
	heightCm: z.number().int().min(120).max(230).optional(),
	pronouns: z.string().trim().max(40).optional(),
});

const INTERESTS = ["fitness", "music", "travel", "film", "gaming", "art", "food", "reading", "hiking", "nightlife", "sports", "photography", "cruising", "sauna", "theatre", "dogs"];
const LOOKING_FOR = ["dating", "relationship", "friends", "hookup", "networking"];
const BODY_TYPES = ["athletic", "fit", "slim", "bear", "twink", "jock", "dad", "average"];
const POSITIONS = ["top", "bottom", "vers", "side"];

function SettingsPage() {
	const { session, refresh, signOut } = useShell();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [tab, setTab] = useState<"profile" | "privacy" | "photos" | "data">("profile");

	const { data, isPending, error, refetch } = useQuery({
		queryKey: ["settings"],
		queryFn: () => api.get<SelfSettings>("settings"),
	});

	const failure = error ? describeFailure(error) : null;
	const profile = data?.profile;

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-4 flex flex-wrap gap-1.5">
				{([
					["profile", "Profile"],
					["photos", "Photos"],
					["privacy", "Privacy"],
					["data", "Account"],
				] as const).map(([id, label]) => (
					<Chip key={id} active={tab === id} onClick={() => setTab(id)}>
						{label}
					</Chip>
				))}
			</div>

			{isPending ? (
				<StateBlock kind="loading" title="Loading your settings" />
			) : failure || !profile ? (
				<StateBlock kind="error" title="Settings could not load" description={failure?.message} action={<button type="button" onClick={() => void refetch()} className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black">Try again</button>} />
			) : tab === "profile" ? (
				<ProfileForm profile={profile} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ["settings"] }); void queryClient.invalidateQueries({ queryKey: ["session"] }); void refresh(); }} />
			) : tab === "photos" ? (
				<PhotosManager capability={session.capabilities.profilePhotos !== false} onSaved={() => void queryClient.invalidateQueries({ queryKey: ["settings"] })} />
			) : tab === "privacy" ? (
				<PrivacyForm settings={data} onSaved={() => void queryClient.invalidateQueries({ queryKey: ["settings"] })} />
			) : (
				<AccountPanel session={session} onRefresh={() => void refetch()} onSignOut={() => void signOut()} onOpenSafety={() => void navigate({ to: "/safety" })} />
			)}
		</div>
	);
}

function ProfileForm({ profile, onSaved }: { profile: NonNullable<SelfSettings["profile"]>; onSaved: () => void }) {
	const push = useToasts((state) => state.push);
	const [form, setForm] = useState({
		displayName: profile.displayName ?? "",
		handle: profile.handle ?? "",
		headline: profile.headline ?? "",
		bio: profile.bio ?? "",
		city: profile.city ?? "",
		interests: profile.interests ?? [],
		lookingFor: profile.lookingFor ?? [],
		heightCm: profile.heightCm ? String(profile.heightCm) : "",
		pronouns: profile.pronouns ?? "",
		bodyType: profile.bodyType ?? "",
		positionRole: profile.positionRole ?? "",
	});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const save = async () => {
		setError("");
		const parsed = profileSchema.safeParse({
			displayName: form.displayName.trim(),
			handle: form.handle.trim().toLowerCase(),
			headline: form.headline.trim() || undefined,
			bio: form.bio.trim() || undefined,
			city: form.city.trim() || undefined,
			interests: form.interests,
			lookingFor: form.lookingFor,
			heightCm: form.heightCm ? Number(form.heightCm) : undefined,
			pronouns: form.pronouns.trim() || undefined,
		});
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		setBusy(true);
		try {
			await api.patch("settings/profile", {
				...parsed.data,
				bodyType: form.bodyType || null,
				positionRole: form.positionRole || null,
			});
			push("Profile saved.", "success");
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "That did not save.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
			<h2 className="text-[16px] font-bold">How you appear</h2>
			<p className="mt-1 text-[12.5px] text-muted">Everything here is visible to members who can see your profile. Your birth date is not — only the age derived from it.</p>

			<div className="mt-4 grid gap-3.5 sm:grid-cols-2">
				<label className="block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Display name</span>
					<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} maxLength={40} className="entry-input" />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Handle</span>
					<input value={form.handle} onChange={(event) => setForm({ ...form, handle: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} maxLength={24} className="entry-input" />
				</label>
				<label className="block sm:col-span-2">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Headline</span>
					<input value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} maxLength={120} placeholder="One line people read first" className="entry-input" />
				</label>
				<label className="block sm:col-span-2">
					<span className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-ink-2">
						About you <span className="font-normal text-faint">{1000 - form.bio.length}</span>
					</span>
					<textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} maxLength={1000} className="entry-input resize-none" />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">City</span>
					<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} maxLength={80} className="entry-input" />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Height (cm)</span>
					<input type="number" min={120} max={230} value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} className="entry-input" />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Pronouns</span>
					<input value={form.pronouns} onChange={(event) => setForm({ ...form, pronouns: event.target.value })} maxLength={40} placeholder="he/him" className="entry-input" />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Body type</span>
					<select value={form.bodyType} onChange={(event) => setForm({ ...form, bodyType: event.target.value })} className="entry-input">
						<option value="">Not stated</option>
						{BODY_TYPES.map((entry) => (
							<option key={entry} value={entry}>{entry}</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Position</span>
					<select value={form.positionRole} onChange={(event) => setForm({ ...form, positionRole: event.target.value })} className="entry-input">
						<option value="">Not stated</option>
						{POSITIONS.map((entry) => (
							<option key={entry} value={entry}>{entry}</option>
						))}
					</select>
				</label>
			</div>

			<div className="mt-4">
				<p className="mb-2 text-[12.5px] font-semibold text-ink-2">Interests ({form.interests.length}/15)</p>
				<div className="flex flex-wrap gap-1.5">
					{INTERESTS.map((entry) => (
						<Chip
							key={entry}
							active={form.interests.includes(entry)}
							onClick={() => setForm({ ...form, interests: form.interests.includes(entry) ? form.interests.filter((item) => item !== entry) : form.interests.length >= 15 ? form.interests : [...form.interests, entry] })}
						>
							{entry}
						</Chip>
					))}
				</div>
			</div>

			<div className="mt-4">
				<p className="mb-2 text-[12.5px] font-semibold text-ink-2">Looking for ({form.lookingFor.length}/6)</p>
				<div className="flex flex-wrap gap-1.5">
					{LOOKING_FOR.map((entry) => (
						<Chip
							key={entry}
							tone="live"
							active={form.lookingFor.includes(entry)}
							onClick={() => setForm({ ...form, lookingFor: form.lookingFor.includes(entry) ? form.lookingFor.filter((item) => item !== entry) : form.lookingFor.length >= 6 ? form.lookingFor : [...form.lookingFor, entry] })}
						>
							{entry}
						</Chip>
					))}
				</div>
			</div>

			{error && <p role="alert" className="mt-3 text-[13px] text-live">{error}</p>}

			<button type="button" onClick={() => void save()} disabled={busy} className="press mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black disabled:opacity-60">
				{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile
			</button>
		</section>
	);
}

type OwnPhoto = { id: string; url: string; position: number; isPrimary: boolean; width: number | null; height: number | null };

function PhotosManager({ capability, onSaved }: { capability: boolean; onSaved: () => void }) {
	const push = useToasts((state) => state.push);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const avatarRef = useRef<HTMLInputElement | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const photos = useQuery({
		queryKey: ["my-photos"],
		queryFn: () => api.get<{ photos: OwnPhoto[] }>("media/photos"),
		enabled: capability,
	});

	const upload = async (files: File[]) => {
		setError("");
		setBusy(true);
		const form = new FormData();
		for (const file of files) form.append("files", file);
		try {
			await api.postForm("media/photos", form);
			push(`${files.length} photo${files.length === 1 ? "" : "s"} saved. The first one is your card photo.`, "success");
			await photos.refetch();
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "The upload failed.");
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	};

	const removePhoto = async (id: string, label: string) => {
		if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return;
		setBusy(true);
		try {
			await api.post("media/photos/delete", { ids: [id] });
			await photos.refetch();
			onSaved();
		} catch (err) {
			push(err instanceof Error ? err.message : "That photo is still there — try again.", "error");
		} finally {
			setBusy(false);
		}
	};

	const removeAll = async (ids: string[]) => {
		if (!window.confirm(`Remove all ${ids.length} photos? Your card will show your initial instead.`)) return;
		setBusy(true);
		try {
			await api.post("media/photos/delete", { ids });
			await photos.refetch();
			push("Photos removed.", "success");
			onSaved();
		} catch (err) {
			push(err instanceof Error ? err.message : "That did not work.", "error");
		} finally {
			setBusy(false);
		}
	};

	const setAvatar = async (file: File) => {
		const form = new FormData();
		form.append("file", file);
		setBusy(true);
		try {
			await api.postForm("media/avatar", form);
			push("Avatar updated.", "success");
			onSaved();
		} catch (err) {
			push(err instanceof Error ? err.message : "That did not work.", "error");
		} finally {
			setBusy(false);
			if (avatarRef.current) avatarRef.current.value = "";
		}
	};

	if (!capability) {
		return <StateBlock kind="disabled" title="Photos are unavailable" description="profile_photos is not readable for your account, so uploading would silently fail. Apply the migrations in supabase/migrations." />;
	}

	const items = photos.data?.photos ?? [];

	if (photos.isPending) return <StateBlock kind="loading" title="Loading your photos" />;

	return (
		<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
			<h2 className="text-[16px] font-bold">Photos</h2>
			<p className="mt-1 text-[12.5px] leading-relaxed text-muted">
				Up to 9, stored in a public bucket — anyone who can find your profile can see them. Do not upload anything you would not want a stranger to keep.
			</p>

			<div className={"mt-4 grid grid-cols-3 gap-2"}>
				{items.map((photo, index) => (
					<figure key={photo.id} className="relative overflow-hidden rounded-xl border border-line">
						<MediaImage src={photo.url} alt={`Your photo ${index + 1}`} ratio="3 / 4" className="w-full" label="This photo could not be loaded" />
						{photo.isPrimary ? <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-gold">Card</span> : null}
						<button
							type="button"
							disabled={busy}
							onClick={() => void removePhoto(photo.id, `photo ${index + 1}`)}
							className="press absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-live"
							aria-label={`Remove photo ${index + 1}`}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					</figure>
				))}

				{items.length < 9 && (
					<button
						type="button"
						disabled={busy}
						onClick={() => inputRef.current?.click()}
						className="press grid aspect-[3/4] place-items-center rounded-xl border border-dashed border-line bg-surface-2 text-faint hover:border-gold/40 hover:text-gold"
					>
						<span className="flex flex-col items-center gap-1">
							<ImagePlus className="h-5 w-5" />
							<span className="text-[11px] font-semibold">{items.length ? "Add" : "First photo"}</span>
						</span>
					</button>
				)}
			</div>

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				multiple
				className="sr-only"
				onChange={(event) => {
					const files = Array.from(event.target.files ?? []);
					const room = 9 - items.length;
					if (!files.length) return;
					if (room <= 0) return setError("Nine photos is the maximum. Remove one before adding another.");
					void upload(files.slice(0, room));
				}}
			/>
			<input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void setAvatar(file); }} />

			{error && <p role="alert" className="mt-3 text-[13px] text-live">{error}</p>}
			{photos.error ? <p className="mt-3 text-[12.5px] text-live">{describeFailure(photos.error).message}</p> : null}

			<div className="mt-4 flex flex-wrap gap-2">
				<button type="button" onClick={() => avatarRef.current?.click()} disabled={busy} className="press flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-semibold text-ink-2 disabled:opacity-60">
					<Camera className="h-4 w-4" /> Set a separate avatar
				</button>
				{items.length > 0 && (
					<button type="button" disabled={busy} onClick={() => void removeAll(items.map((photo) => photo.id))} className="press ml-auto flex h-11 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] font-semibold text-live disabled:opacity-60">
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove all {items.length}
					</button>
				)}
			</div>
			<p className="mt-2 text-[11.5px] leading-relaxed text-faint">
				The avatar is the small circle in chats and comments; your card in Nearby always leads with photo 1.
			</p>
		</section>
	);
}

const AVAILABILITY_MINUTES = 120;

function PrivacyForm({ settings, onSaved }: { settings: SelfSettings; onSaved: () => void }) {
	const push = useToasts((state) => state.push);
	const [busy, setBusy] = useState<string | null>(null);
	const [locating, setLocating] = useState(false);
	const [note, setNote] = useState("");
	const [exposure, setExposure] = useState(settings.privacy.exposureLevel);

	const patchPrivacy = async (body: Record<string, unknown>, label: string) => {
		setBusy(label);
		try {
			await api.patch("settings/privacy", body);
			push("Saved.", "success");
			onSaved();
		} catch (err) {
			push(err instanceof Error ? err.message : "That did not save.", "error");
		} finally {
			setBusy(null);
		}
	};

	const shareLocation = () => {
		if (!("geolocation" in navigator)) {
			setNote("This browser has no location support, so FYK keeps using your city.");
			return;
		}
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				setLocating(false);
				await patchPrivacy({ latitude: position.coords.latitude, longitude: position.coords.longitude }, "location");
				setNote("Your approximate area was refreshed. The precise fix was snapped to the coarse grid before it was stored, and never saved.");
			},
			(cause) => {
				setLocating(false);
				setNote(cause.code === 1 ? "Location permission was declined. FYK will keep searching by city." : "No position fix right now. Try again outdoors or check your browser settings.");
			},
			{ timeout: 10_000, maximumAge: 300_000, enableHighAccuracy: false },
		);
	};

	return (
		<div className="space-y-4">
			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
				<h2 className="text-[16px] font-bold">What others can see</h2>
				<div className="mt-3 space-y-1">
					<Row title="Show my distance" description="Off means cards show your city instead of kilometres." icon={<MapPin className="h-4 w-4" />}>
						<Switch checked={!settings.privacy.hideDistance} onChange={(value) => void patchPrivacy({ hideDistance: !value }, "distance")} label="Show my distance" />
					</Row>
					<Row title="Show when I'm online" description="Derived from your last request. Turning it off makes you appear offline to everyone." icon={settings.privacy.hideOnline ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}>
						<Switch checked={!settings.privacy.hideOnline} onChange={(value) => void patchPrivacy({ hideOnline: !value }, "online")} label="Show when I'm online" />
					</Row>
					<Row title="Incognito" description="Stay out of the Nearby deck. Existing matches and Board replies still see you." icon={<BadgeCheck className="h-4 w-4" />}>
						<Switch checked={settings.privacy.incognito} onChange={(value) => void patchPrivacy({ incognito: value }, "incognito")} label="Incognito" />
					</Row>
				</div>

				<div className="mt-4 border-t border-line-soft pt-4">
					<p className="text-[12.5px] font-semibold text-ink-2">Profile content level</p>
					<p className="mt-1 text-[12px] leading-relaxed text-muted">What you see in Nearby and what your own cards are filed under. Only clean content is shown to accounts under 21.</p>
					<div className="mt-2.5 flex flex-wrap gap-1.5">
						{(["clean", "mature", "explicit"] as const).map((level) => (
							<Chip key={level} active={exposure === level} tone={level === "clean" ? "gold" : "violet"} onClick={() => { setExposure(level); void patchPrivacy({ exposureLevel: level }, "exposure"); }}>
								{level}
							</Chip>
						))}
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
				<h2 className="text-[16px] font-bold">Right now</h2>
				<p className="mt-1 text-[12.5px] leading-relaxed text-muted">
					"Open to meet" is a window you set, not a live status — it clears when the window ends.
					{settings.privacy.availableUntil ? ` Currently set until ${timeAgo(settings.privacy.availableUntil)}.` : " It is currently off."}
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<Switch checked={settings.privacy.openToMeet} onChange={(value) => void patchPrivacy({ openToMeet: value, availableMinutes: AVAILABILITY_MINUTES }, "availability")} label="Open to meet" tone="live" />
					<span className={cn("text-[13px] font-semibold", settings.privacy.openToMeet ? "text-live" : "text-muted")}>{settings.privacy.openToMeet ? `Open for ${AVAILABILITY_MINUTES / 60} hours` : "Not looking right now"}</span>
					<button type="button" onClick={shareLocation} disabled={locating} className="press ml-auto flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-ink-2">
						{locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh my area
					</button>
				</div>
				{note && <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{note}</p>}
				{busy && <p className="mt-2 text-[12px] text-faint">Saving…</p>}
			</section>
		</div>
	);
}

function AccountPanel({ session, onRefresh, onSignOut, onOpenSafety }: { session: { userId: string | null; role: string }; onRefresh: () => void; onSignOut: () => void; onOpenSafety: () => void }) {
	const navigate = useNavigate();
	return (
		<div className="space-y-4">
			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
				<h2 className="text-[16px] font-bold">Session</h2>
				<dl className="mt-3 space-y-2 text-[13px]">
					<div className="flex items-center justify-between gap-3">
						<dt className="text-muted">Signed in</dt>
						<dd className="font-mono text-[12px] text-ink-2">{session.userId ? `${session.userId.slice(0, 8)}…` : "no"}</dd>
					</div>
					<div className="flex items-center justify-between gap-3">
						<dt className="text-muted">Role</dt>
						<dd className="font-semibold text-ink-2">{session.role}</dd>
					</div>
				</dl>
				<p className="mt-3 text-[12px] leading-relaxed text-faint">
					Your id is shown truncated on purpose: a support agent asking for the full id is the classic way to phish a session. FYK support never needs it.
				</p>
				<div className="mt-4 flex flex-wrap gap-2">
					<button type="button" onClick={onOpenSafety} className="press flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-semibold text-ink-2">
						<ShieldCheck className="h-4 w-4 text-gold" /> Safety centre
					</button>
					<button type="button" onClick={() => void navigate({ to: "/notifications" })} className="press h-11 rounded-full border border-line px-4 text-[13.5px] font-semibold text-ink-2">
						Activity
					</button>
					<button type="button" onClick={onRefresh} className="press flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-semibold text-ink-2">
						<RefreshCw className="h-4 w-4" /> Re-check server state
					</button>
					<button type="button" onClick={onSignOut} className="press ml-auto flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-semibold text-live">
						<LogOut className="h-4 w-4" /> Sign out
					</button>
				</div>
			</section>

			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
				<h2 className="text-[16px] font-bold">Deleting your account</h2>
				<p className="mt-1.5 text-[13px] leading-relaxed text-muted">
					There is no self-service delete in this build, and the app does not claim one. To remove your account, use the safety centre's "report a problem with my own account" flow below and a moderator will delete it. This is a known gap, not a hidden feature.
				</p>
				<button type="button" onClick={onOpenSafety} className="press mt-3 flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] font-semibold text-ink-2">
					<Check className="h-4 w-4 text-gold" /> Open the safety centre
				</button>
			</section>
		</div>
	);
}

function Row({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-3 border-b border-line-soft py-3 last:border-0">
			<span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-gold">{icon}</span>
			<div className="min-w-0 flex-1">
				<p className="text-[13.5px] font-semibold text-ink">{title}</p>
				<p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{description}</p>
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}
