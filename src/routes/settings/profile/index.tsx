import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ChevronLeft, Crown, Save } from "lucide-react";
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useAuthStore } from "#/domains/auth/store";
import { getSupabase } from "#/integrations/supabase/client";
import { requireDocumentSession } from "#/lib/document-auth";

export const Route = createFileRoute("/settings/profile/")({
	// AUDIT §3.3: a private screen must not be rendered for a request that carries no
	// session. `requireDocumentSession` is the isomorphic guard — its client branch is
	// a no-op, because a browser has no credential to inspect and `/api/*` verifies
	// every request and 401s without one; its server branch is the redirect.
	beforeLoad: async () => {
		await requireDocumentSession();
	},
	component: ProfileEditPage,
});

interface ProfileForm {
	first_name: string;
	about: string;
	age: string;
	height: string;
	weight: string;
	position: string;
	relationship_status: string;
	looking_for: string[];
	body_type: string;
	ethnicity: string;
	hiv_status: string;
	last_tested: string;
	pronouns: string;
}

const LOOKING_FOR_OPTIONS = [
	"Chat",
	"Friends",
	"Networking",
	"Right Now",
	"Relationship",
	"Hookup",
];

const POSITION_OPTIONS = ["Top", "Bottom", "Versatile", "Side", "Oral"];

const BODY_TYPE_OPTIONS = [
	"Athletic",
	"Average",
	"Large",
	"Muscular",
	"Slender",
	"Stocky",
];

const RELATIONSHIP_STATUS_OPTIONS = [
	"Single",
	"In a relationship",
	"Married",
	"Divorced",
	"Widowed",
	"Open relationship",
];

const INITIAL_FORM: ProfileForm = {
	first_name: "",
	about: "",
	age: "",
	height: "",
	weight: "",
	position: "",
	relationship_status: "",
	looking_for: [],
	body_type: "",
	ethnicity: "",
	hiv_status: "prefer-not-to-say",
	last_tested: "",
	pronouns: "",
};


function ProfileEditPage() {
	const { auth } = useAuthStore();
	const [form, setForm] = useState<ProfileForm>(INITIAL_FORM);
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [activeSection, setActiveSection] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [uploadingPhoto, setUploadingPhoto] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [photos, setPhotos] = useState<string[]>([]);

	// The screen's own vocabulary (`first_name`, `about`) mapped onto the API's
	// column aliases, in one place so load and save can never disagree.
	const applyProfile = useCallback((profile: Record<string, unknown> | null) => {
		if (!profile) return;
		const tagList = (value: unknown) =>
			Array.isArray(value)
				? value
							.map((item) => (typeof item === "string" ? item : String(item ?? "")))
							.filter((item) => item !== "")
					: [];
		const nextPhotos = tagList(profile.photos);
		setPhotos(nextPhotos);
		setForm((prev) => ({
			...prev,
			first_name: String(profile.pseudo ?? ""),
			about: String(profile.description ?? ""),
			age: profile.age == null ? "" : String(profile.age),
			height: profile.height == null ? "" : String(profile.height),
			weight: profile.weight == null ? "" : String(profile.weight),
			position: tagList(profile.position)[0] ?? "",
			relationship_status: String(profile.relationship_status ?? ""),
			looking_for: tagList(profile.looking_for),
			body_type: String(profile.body_type ?? ""),
			ethnicity: String(profile.ethnicity ?? ""),
			pronouns: String(profile.pronouns ?? ""),
		}));
		const first = nextPhotos[0];
		if (first) setPhotoPreview(first);
	}, []);

	// ── Load the caller's own row through the API ─────────────────────────
	// `public.users` is not selectable with a browser token any more (0018),
	// and never should have been for this screen: the API already shapes the
	// row into exactly these keys, and it refuses fields it does not own.
	useEffect(() => {
		let cancelled = false;
		async function loadProfile() {
			if (!auth?.user) {
				setLoading(false);
				return;
			}
			try {
				const response = await fetch("/api/profile", {
					credentials: "include",
					headers: { accept: "application/json" },
				});
				if (!response.ok) {
					if (!cancelled)
						setLoadError(
							response.status === 401
								? "Your session expired; sign in again to edit your profile."
								: `Could not load your profile (HTTP ${response.status}).`,
						);
					return;
				}
				const payload = (await response.json()) as {
					profile?: Record<string, unknown> | null;
				};
				if (cancelled) return;
				applyProfile(payload.profile ?? null);
				// HIV status and the testing date have no column anywhere: they are
				// stored on the auth record, which is the only place they exist.
				const meta = auth.user.user_metadata ?? {};
				setForm((prev) => ({
					...prev,
					hiv_status: String(meta.hiv_status ?? "prefer-not-to-say"),
					last_tested: String(meta.last_tested ?? ""),
				}));
			} catch {
				if (!cancelled)
					setLoadError("Could not reach the server; your profile is not shown.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		loadProfile();
		return () => {
			cancelled = true;
		};
	}, [applyProfile, auth?.user]);

	const updateField = useCallback(
		<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
			setForm((prev) => ({ ...prev, [field]: value }));
			setSaved(false);
		},
		[],
	);

	const toggleLookingFor = useCallback((option: string) => {
		setForm((prev) => {
			const current = prev.looking_for;
			const next = current.includes(option)
				? current.filter((v) => v !== option)
				: [...current, option];
			return { ...prev, looking_for: next };
		});
		setSaved(false);
	}, []);

	// ── Save profile to Supabase (users table + auth metadata) ───────────────
	const handleSave = useCallback(async () => {
		setSaving(true);
		setLoadError(null);
		try {
			if (!auth?.user) throw new Error("Not authenticated");

			// One write, in the API's vocabulary, with empty inputs omitted rather than
			// sent as `null`: `age: null` fails the 18+ check instead of clearing it.
			const payload: Record<string, unknown> = {};
			const put = (key: string, value: string) => {
				const trimmed = value.trim();
				if (trimmed) payload[key] = trimmed;
			};
			put("pseudo", form.first_name);
			put("description", form.about);
			put("body_type", form.body_type);
			put("ethnicity", form.ethnicity);
			put("pronouns", form.pronouns);
			put("relationship_status", form.relationship_status);
			if (form.age) payload.age = Number(form.age);
			if (form.height) payload.height = Number(form.height);
			if (form.weight) payload.weight = Number(form.weight);
			payload.looking_for = form.looking_for;
			payload.position = form.position ? [form.position] : [];

			const response = await fetch("/api/profile", {
				method: "PUT",
				credentials: "include",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
				},
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				const detail = (await response.json().catch(() => null)) as
					| { error?: string | { message?: string }; message?: string }
					| null;
				const message =
					(typeof detail?.error === "string"
						? detail.error
						: detail?.error?.message) ??
					detail?.message ??
					`HTTP ${response.status}`;
				throw new Error(message);
			}
			const saved = (await response.json().catch(() => null)) as {
				profile?: Record<string, unknown> | null;
			} | null;
			applyProfile(saved?.profile ?? null);

			// 2. HIV status and the testing date have no column anywhere — they were only
			//    ever readable from the auth record, so that is where they are written,
			//    and the failure is reported instead of being awaited into a void.
			const supabase = getSupabase();
			if (!supabase) throw new Error("Supabase is not configured.");
			const { error: metaError } = await supabase.auth.updateUser({
				data: {
					hiv_status: form.hiv_status || null,
					last_tested: form.last_tested || null,
				},
			});
			if (metaError) throw new Error(metaError.message);

			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		} catch (err) {
			console.error("Failed to save profile:", err);
			setLoadError(
				err instanceof Error
					? `Could not save: ${err.message}`
					: "Could not save your profile.",
			);
		} finally {
			setSaving(false);
		}
	}, [applyProfile, auth?.user, form]);

	// ── Photo upload to Supabase Storage ─────────────────────────────────────
	const handlePhotoSelected = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			if (!file.type.startsWith("image/")) {
				alert("Please select an image file.");
				return;
			}
			if (file.size > 5 * 1024 * 1024) {
				alert("Image must be under 5 MB.");
				return;
			}

			const supabase = getSupabase();
			if (!supabase || !auth?.user) {
				alert("Not authenticated.");
				return;
			}

			setUploadingPhoto(true);
			try {
				const ext = file.name.split(".").pop() ?? "jpg";
				const path = `avatars/${auth.user.id}/${Date.now()}.${ext}`;

				const { error: uploadError } = await supabase.storage
					.from("media")
					.upload(path, file, { contentType: file.type, upsert: false });

				if (uploadError) throw uploadError;

				const { data: urlData } = supabase.storage
					.from("media")
					.getPublicUrl(path);

				if (!urlData?.publicUrl) throw new Error("Could not get photo URL");

				setPhotoPreview(urlData.publicUrl);

				// The uploaded object exists in Storage; the profile only *lists*
				// photo paths, and that list belongs to `users.photos` — which a
				// browser token cannot write. So the list in state is updated and
				// saved through the API, which also caps it at 12 entries.
				const updatedPhotos = [
					urlData.publicUrl,
					...photos.filter((path) => path !== urlData.publicUrl),
				].slice(0, 12);

				const photoSave = await fetch("/api/profile", {
					method: "PUT",
					credentials: "include",
					headers: {
						"content-type": "application/json",
						accept: "application/json",
					},
					body: JSON.stringify({ photos: updatedPhotos }),
				});
				if (!photoSave.ok) {
					throw new Error(
						"The photo uploaded, but your profile could not be updated.",
					);
				}

				setPhotos(updatedPhotos);

				setSaved(false);
			} catch (err) {
				console.error("Photo upload failed:", err);
				setLoadError(
					err instanceof Error ? err.message : "Photo upload failed. Please try again.",
				);
			} finally {
				setUploadingPhoto(false);
				event.target.value = "";
			}
		},
		[auth?.user, photos],
	);

	const sections = [
		{
			id: "basics",
			title: "BASICS",
			fields: (
				<div className="space-y-4">
					<FormField label="Display Name">
						<input
							type="text"
							value={form.first_name}
							onChange={(e) => updateField("first_name", e.target.value)}
							placeholder="Your display name"
							className="field-input"
						/>
					</FormField>
					<FormField label="About Me">
						<textarea
							value={form.about}
							onChange={(e) => updateField("about", e.target.value)}
							placeholder="Tell others about yourself..."
							rows={4}
							maxLength={300}
							className="field-input resize-none"
						/>
						<p className="mt-1 text-right text-[10px] text-white/30">
							{form.about.length}/300
						</p>
					</FormField>
					<div className="grid grid-cols-2 gap-3">
						<FormField label="Age">
							<input
								type="number"
								value={form.age}
								onChange={(e) => updateField("age", e.target.value)}
								placeholder="25"
								min={18}
								max={120}
								className="field-input"
							/>
						</FormField>
						<FormField label="Pronouns">
							<select
								value={form.pronouns}
								onChange={(e) => updateField("pronouns", e.target.value)}
								className="field-input"
							>
								<option value="">Select</option>
								<option value="he/him">He/Him</option>
								<option value="she/her">She/Her</option>
								<option value="they/them">They/Them</option>
								<option value="other">Other</option>
							</select>
						</FormField>
					</div>
				</div>
			),
		},
		{
			id: "body",
			title: "BODY",
			fields: (
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						<FormField label="Height (cm)">
							<input
								type="number"
								value={form.height}
								onChange={(e) => updateField("height", e.target.value)}
								placeholder="175"
								className="field-input"
							/>
						</FormField>
						<FormField label="Weight (kg)">
							<input
								type="number"
								value={form.weight}
								onChange={(e) => updateField("weight", e.target.value)}
								placeholder="75"
								className="field-input"
							/>
						</FormField>
					</div>
					<FormField label="Body Type">
						<div className="flex flex-wrap gap-2">
							{BODY_TYPE_OPTIONS.map((opt) => (
								<button
									key={opt}
									type="button"
									onClick={() =>
										updateField("body_type", form.body_type === opt ? "" : opt)
									}
									className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
										form.body_type === opt
											? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
											: "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10"
									}`}
								>
									{opt}
								</button>
							))}
						</div>
					</FormField>
					<FormField label="Ethnicity">
						<input
							type="text"
							value={form.ethnicity}
							onChange={(e) => updateField("ethnicity", e.target.value)}
							placeholder="Optional"
							className="field-input"
						/>
					</FormField>
				</div>
			),
		},
		{
			id: "identity",
			title: "IDENTITY",
			fields: (
				<div className="space-y-4">
					<FormField label="Position">
						<div className="flex flex-wrap gap-2">
							{POSITION_OPTIONS.map((opt) => (
								<button
									key={opt}
									type="button"
									onClick={() =>
										updateField("position", form.position === opt ? "" : opt)
									}
									className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
										form.position === opt
											? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
											: "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10"
									}`}
								>
									{opt}
								</button>
							))}
						</div>
					</FormField>
					<FormField label="Looking For">
						<div className="flex flex-wrap gap-2">
							{LOOKING_FOR_OPTIONS.map((opt) => (
								<button
									key={opt}
									type="button"
									onClick={() => toggleLookingFor(opt)}
									className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
										form.looking_for.includes(opt)
											? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
											: "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10"
									}`}
								>
									{opt}
								</button>
							))}
						</div>
					</FormField>
					<FormField label="Relationship Status">
						<select
							value={form.relationship_status}
							onChange={(e) =>
								updateField("relationship_status", e.target.value)
							}
							className="field-input"
						>
							<option value="">Select</option>
							{RELATIONSHIP_STATUS_OPTIONS.map((opt) => (
								<option key={opt} value={opt}>
									{opt}
								</option>
							))}
						</select>
					</FormField>
				</div>
			),
		},
		{
			id: "health",
			title: "HEALTH",
			fields: (
				<div className="space-y-4">
					<FormField label="HIV Status">
						<select
							value={form.hiv_status}
							onChange={(e) => updateField("hiv_status", e.target.value)}
							className="field-input"
						>
							<option value="">Select</option>
							<option value="negative">Negative</option>
							<option value="positive">Positive</option>
							<option value="undetectable">Undetectable</option>
							<option value="unknown">Unknown</option>
							<option value="prefer-not-to-say">Prefer not to say</option>
						</select>
					</FormField>
					<FormField label="Last Tested">
						<input
							type="date"
							value={form.last_tested}
							onChange={(e) => updateField("last_tested", e.target.value)}
							className="field-input"
						/>
					</FormField>
				</div>
			),
		},
	];

	if (loading) {
		return (
			<main className="screen-nav-host">
				<div className="h-full w-full overflow-y-auto overscroll-none">
					<div className="mx-auto max-w-lg px-4 py-4 pb-24">
						<div className="mb-6 flex items-center gap-3">
							<Link
								to="/settings"
								className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10"
							>
								<ChevronLeft className="h-5 w-5" />
							</Link>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								Edit Profile
							</h1>
						</div>
						<div className="flex items-center justify-center py-20 text-sm text-white/40">
							<span className="mr-2 h-4 w-4 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
							Loading profile…
						</div>
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					{/* Header */}
					<div className="mb-6 flex items-center gap-3">
						<Link
							to="/settings"
							className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10"
						>
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<h1 className="font-display text-xl font-semibold tracking-wide text-white">
							Edit Profile
						</h1>
					</div>

					{/* Avatar */}
					<div className="mb-8 flex flex-col items-center gap-3">
						<input
							ref={photoInputRef}
							type="file"
							accept="image/*"
							onChange={handlePhotoSelected}
							hidden
						/>
						<div className="relative">
							<div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500/20 to-purple-500/20 ring-2 ring-amber-500/30">
								{uploadingPhoto ? (
									<span className="h-6 w-6 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
								) : photoPreview ? (
									<img
										src={photoPreview}
										alt="Your selected profile"
										className="size-full object-cover"
									/>
								) : form.first_name ? (
									<span className="text-3xl font-bold text-amber-400">
										{form.first_name.charAt(0).toUpperCase()}
									</span>
								) : (
									<Crown className="h-10 w-10 text-amber-400/40" />
								)}
							</div>
							<button
								type="button"
								onClick={() => photoInputRef.current?.click()}
								disabled={uploadingPhoto}
								aria-label="Change profile photo"
								className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-black transition hover:bg-amber-400 disabled:opacity-50"
							>
								<Camera className="h-4 w-4" />
							</button>
						</div>
						<button
							type="button"
							onClick={() => photoInputRef.current?.click()}
							disabled={uploadingPhoto}
							className="text-xs font-medium text-amber-400/70 transition hover:text-amber-400 disabled:opacity-50"
						>
							{uploadingPhoto ? "Uploading…" : "Change photo"}
						</button>
					</div>

					{/* Sections */}
					<div className="space-y-6">
						{sections.map((section) => (
							<div key={section.id}>
								<button
									type="button"
									onClick={() =>
										setActiveSection(
											activeSection === section.id ? null : section.id,
										)
									}
									className="mb-3 flex w-full items-center justify-between"
								>
									<p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
										{section.title}
									</p>
									<svg
										aria-hidden="true"
										className={`h-4 w-4 text-white/30 transition-transform ${activeSection === section.id ? "rotate-90" : ""}`}
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="m9 18 6-6-6-6" />
									</svg>
								</button>
								{activeSection === section.id && (
									<div
										className="overflow-hidden rounded-xl bg-white/[0.03] p-4"
										style={{ animation: "profile-expand 0.2s ease-out" }}
									>
										{section.fields}
									</div>
								)}
							</div>
						))}
					</div>

					{loadError ? (
						<div
							role="alert"
							className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200"
						>
							{loadError}
						</div>
					) : null}

					{/* Save Button */}
					<div className="sticky bottom-20 mt-8">
						<button
							type="button"
							onClick={handleSave}
							disabled={saving}
							className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
							style={{
								background: saved
									? "linear-gradient(135deg, #22c55e, #16a34a)"
									: "linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
								color: "#000",
								boxShadow: saved
									? "0 0 30px rgba(34,197,94,0.3)"
									: "0 0 30px rgba(234,179,8,0.3)",
							}}
						>
							{saving ? (
								<span className="flex items-center gap-2">
									<span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
									Saving...
								</span>
							) : saved ? (
								<>Saved</>
							) : (
								<>
									<Save className="h-4 w-4" />
									SAVE CHANGES
								</>
							)}
						</button>
					</div>
				</div>
			</div>

			<style>{`
				.field-input {
					width: 100%;
					background: rgba(255,255,255,0.05);
					border: 1px solid rgba(255,255,255,0.1);
					border-radius: 0.75rem;
					padding: 0.5rem 0.75rem;
					font-size: 0.875rem;
					color: white;
					transition: border-color 0.2s, box-shadow 0.2s;
				}
				.field-input::placeholder { color: rgba(255,255,255,0.25); }
				.field-input:focus {
					outline: none;
					border-color: rgba(234,179,8,0.5);
					box-shadow: 0 0 20px rgba(234,179,8,0.1);
				}
				select.field-input { appearance: none; cursor: pointer; }
				@keyframes profile-expand {
					from { opacity: 0; max-height: 0; }
					to { opacity: 1; max-height: 800px; }
				}
			`}</style>
		</main>
	);
}

function FormField({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<fieldset className="block min-w-0">
			<legend className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-white/50">
				{label}
			</legend>
			{children}
		</fieldset>
	);
}
