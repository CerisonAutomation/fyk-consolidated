import { createFileRoute, Link } from "@tanstack/react-router";
import { SelfieVerify } from "@/components/verification/selfie-verify";

/**
 * `/verify` — verification status and the selfie check.
 *
 * The generated screen fetched `/api/verify`, listed "items", and posted to
 * `/api/verify/{id}/action`. Verification is not a list: it is one person's level,
 * one pose challenge and one submission, which is what
 * `#/routes/api/profile/verification` holds and what
 * `#/components/verification/selfie-verify` renders.
 */
export const Route = createFileRoute("/verify/")({
	component: VerifyScreen,
});

function VerifyScreen() {
	return (
		<div className="mx-auto max-w-md space-y-4 p-4 pb-24">
			<SelfieVerify />
			<p className="text-[12px] text-zinc-500">
				Only need to retake the photo?{" "}
				<Link to="/verify/photo" className="underline">
					Go straight to the capture step
				</Link>
				.
			</p>
		</div>
	);
}
