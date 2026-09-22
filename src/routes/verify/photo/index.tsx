import { createFileRoute, Link } from "@tanstack/react-router";
import { SelfieVerify } from "@/components/verification/selfie-verify";

/**
 * `/verify/photo` — the capture step on its own.
 *
 * Same flow as `/verify`, without the status panel: this is the screen a "retake
 * photo" link lands on. It fetched `/api/verify/photo` before, a path nothing serves,
 * and posted to `/api/verify/photo/{id}/action`; both are gone, and the shared
 * component talks to `#/routes/api/profile/verification` instead.
 */
export const Route = createFileRoute("/verify/photo/")({
	component: VerifyPhotoScreen,
});

function VerifyPhotoScreen() {
	return (
		<div className="mx-auto max-w-md space-y-4 p-4 pb-24">
			<SelfieVerify compact />
			<p className="text-[12px] text-zinc-500">
				<Link to="/verify" className="underline">
					Back to verification status
				</Link>
			</p>
		</div>
	);
}
