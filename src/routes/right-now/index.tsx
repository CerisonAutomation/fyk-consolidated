import { createFileRoute } from "@tanstack/react-router";
import { Zap, MapPin, Camera } from "lucide-react";

export const Route = createFileRoute("/right-now/")({
	component: RightNowPage,
});

function RightNowPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center justify-between px-4 py-2">
				<h1 className="text-lg font-semibold">Right Now</h1>
			</div>
			<div className="flex flex-1 px-6">
				<div className="m-auto w-full max-w-md space-y-6">
					<div className="rounded-lg border border-border p-6 text-center">
						<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
							<Zap className="size-7 text-primary" />
						</div>
						<h2 className="mb-2 text-lg font-semibold">
							Share What You're Up To
						</h2>
						<p className="text-sm text-muted-foreground">
							This feature allows you to share what you're doing right now with
							people nearby. Post a quick update so others can see your current
							status and connect with you in the moment.
						</p>
					</div>

					<div className="space-y-3">
						<FeatureItem
							icon={<Zap className="size-4" />}
							title="Real-time updates"
							description="Let people know what you're up to right now, whether you're looking to chat, meet up, or just hang out."
						/>
						<FeatureItem
							icon={<Camera className="size-4" />}
							title="Share photos"
							description="Add a photo to your Right Now post to give others a glimpse of what you're doing."
						/>
						<FeatureItem
							icon={<MapPin className="size-4" />}
							title="Location sharing"
							description="Choose to share your location so nearby people can find you."
						/>
					</div>
				</div>
			</div>
		</main>
	);
}

function FeatureItem({
	icon,
	title,
	description,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
}) {
	return (
		<div className="flex gap-3 rounded-lg border border-border p-4">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
				{icon}
			</div>
			<div className="min-w-0">
				<h3 className="text-sm font-medium">{title}</h3>
				<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}
