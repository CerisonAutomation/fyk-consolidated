import { requireAuth } from "#/domains/auth/guard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { usePatchProfile, useProfile } from "#/core/api/hooks/use-profiles";
import { useAuthStore } from "#/domains/auth/store";
import { showErrorToast } from "#/core/lib/error-toast";
import {
	sexualPositions,
	bodyTypes,
	hivStatuses,
	tribes,
	lookingFor as lookingForOptions,
} from "#/core/model/profiles";

export const Route = createFileRoute("/settings/profile/")({
	beforeLoad: requireAuth,
	component: ProfileEditPage,
});

function ProfileEditPage() {
	const { auth } = useAuthStore();
	const userId = auth?.userId;
	const { data: profile, isLoading } = useProfile(Number(userId));
	const patchProfile = usePatchProfile();

	const [displayName, setDisplayName] = useState("");
	const [aboutMe, setAboutMe] = useState("");
	const [bodyType, setBodyType] = useState<string>("");
	const [sexualPosition, setSexualPosition] = useState<string>("");
	const [height, setHeight] = useState<string>("");
	const [weight, setWeight] = useState<string>("");
	const [hivStatus, setHivStatus] = useState<string>("");
	const [grindrTribes, setGrindrTribes] = useState<number[]>([]);
	const [selectedLookingFor, setSelectedLookingFor] = useState<number[]>([]);
	const [saved, setSaved] = useState(false);
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		if (profile && !initialized) {
			setDisplayName((profile.displayName as string) ?? "");
			setAboutMe((profile.aboutMe as string) ?? "");
			setBodyType(
				profile.bodyType != null ? String(profile.bodyType) : "",
			);
			setSexualPosition(
				profile.sexualPosition != null
					? String(profile.sexualPosition)
					: "",
			);
			setHeight(
				profile.height != null ? String(profile.height) : "",
			);
			setWeight(
				profile.weight != null ? String(profile.weight) : "",
			);
			setHivStatus(
				profile.hivStatus != null
					? String(profile.hivStatus)
					: "",
			);
			setGrindrTribes(
				Array.isArray(profile.grindrTribes)
					? (profile.grindrTribes as number[])
					: [],
			);
			setSelectedLookingFor(
				Array.isArray(profile.lookingFor)
					? (profile.lookingFor as number[])
					: [],
			);
			setInitialized(true);
		}
	}, [profile, initialized]);

	function toggleTribe(tribeValue: number) {
		setGrindrTribes((prev) =>
			prev.includes(tribeValue)
				? prev.filter((t) => t !== tribeValue)
				: [...prev, tribeValue],
		);
	}

	function toggleLookingFor(value: number) {
		setSelectedLookingFor((prev) =>
			prev.includes(value)
				? prev.filter((v) => v !== value)
				: [...prev, value],
		);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!userId) return;

		const patch: Record<string, unknown> = {
			displayName,
			aboutMe,
			bodyType: bodyType ? Number(bodyType) : null,
			sexualPosition: sexualPosition ? Number(sexualPosition) : null,
			height: height ? Number(height) : null,
			weight: weight ? Number(weight) : null,
			hivStatus: hivStatus ? Number(hivStatus) : null,
			grindrTribes,
			lookingFor: selectedLookingFor,
		};

		patchProfile.mutate(
			{
				cacheProfileId: Number(userId),
				patch,
			},
			{
				onSuccess: () => {
					setSaved(true);
					setTimeout(() => setSaved(false), 2000);
				},
				onError: (error) => {
					showErrorToast({ label: "Failed to save profile", error });
				},
			},
		);
	};

	if (isLoading) {
		return (
			<main className="screen-nav-host">
				<div className="flex items-center gap-3 border-b border-border px-4 py-3">
					<Link
						to="/settings"
						className="text-muted-foreground hover:text-foreground"
					>
						&larr;
					</Link>
					<h1 className="text-lg font-semibold">Edit Profile</h1>
				</div>
				<div className="flex flex-1 items-center justify-center p-6">
					<span className="text-muted-foreground">Loading profile...</span>
				</div>
			</main>
		);
	}

	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link
					to="/settings"
					className="text-muted-foreground hover:text-foreground"
				>
					&larr;
				</Link>
				<h1 className="text-lg font-semibold">Edit Profile</h1>
			</div>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 pb-24">
				{saved && (
					<div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
						Profile saved!
					</div>
				)}

				{/* Display Name */}
				<div>
					<label className="mb-1 block text-sm font-medium">
						Display Name
					</label>
					<input
						type="text"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						placeholder="Your display name"
					/>
				</div>

				{/* About Me */}
				<div>
					<label className="mb-1 block text-sm font-medium">About Me</label>
					<textarea
						value={aboutMe}
						onChange={(e) => setAboutMe(e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						rows={4}
						placeholder="Tell others about yourself"
					/>
				</div>

				{/* Body Type */}
				<div>
					<label className="mb-1 block text-sm font-medium">Body Type</label>
					<select
						value={bodyType}
						onChange={(e) => setBodyType(e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="">Not specified</option>
						{Object.entries(bodyTypes).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>

				{/* Sexual Position */}
				<div>
					<label className="mb-1 block text-sm font-medium">
						Sexual Position
					</label>
					<select
						value={sexualPosition}
						onChange={(e) => setSexualPosition(e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="">Not specified</option>
						{Object.entries(sexualPositions).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>

				{/* Height and Weight side by side */}
				<div className="grid grid-cols-2 gap-3">
					<div>
						<label className="mb-1 block text-sm font-medium">
							Height (cm)
						</label>
						<input
							type="number"
							value={height}
							onChange={(e) => setHeight(e.target.value)}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="cm"
							min={100}
							max={250}
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium">
							Weight (kg)
						</label>
						<input
							type="number"
							value={weight}
							onChange={(e) => setWeight(e.target.value)}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="kg"
							min={30}
							max={300}
						/>
					</div>
				</div>

				{/* HIV Status */}
				<div>
					<label className="mb-1 block text-sm font-medium">
						HIV Status
					</label>
					<select
						value={hivStatus}
						onChange={(e) => setHivStatus(e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="">Not specified</option>
						{Object.entries(hivStatuses).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>

				{/* Grindr Tribes (multi-select) */}
				<div>
					<label className="mb-1 block text-sm font-medium">
						Tribes
					</label>
					<div className="flex flex-wrap gap-2">
						{Object.entries(tribes).map(([value, label]) => {
							const numValue = Number(value);
							const isSelected = grindrTribes.includes(numValue);
							return (
								<button
									key={value}
									type="button"
									onClick={() => toggleTribe(numValue)}
									className={`rounded-full border px-3 py-1 text-sm transition-colors ${
										isSelected
											? "border-primary bg-primary text-primary-foreground"
											: "border-border text-muted-foreground hover:bg-muted/50"
									}`}
								>
									{label}
								</button>
							);
						})}
					</div>
				</div>

				{/* Looking For (multi-select) */}
				<div>
					<label className="mb-1 block text-sm font-medium">
						Looking For
					</label>
					<div className="flex flex-wrap gap-2">
						{Object.entries(lookingForOptions).map(([value, label]) => {
							const numValue = Number(value);
							const isSelected = selectedLookingFor.includes(numValue);
							return (
								<button
									key={value}
									type="button"
									onClick={() => toggleLookingFor(numValue)}
									className={`rounded-full border px-3 py-1 text-sm transition-colors ${
										isSelected
											? "border-primary bg-primary text-primary-foreground"
											: "border-border text-muted-foreground hover:bg-muted/50"
									}`}
								>
									{label}
								</button>
							);
						})}
					</div>
				</div>

				{/* Submit */}
				<button
					type="submit"
					disabled={patchProfile.isPending}
					className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					{patchProfile.isPending ? "Saving..." : "Save Profile"}
				</button>
			</form>
		</main>
	);
}
