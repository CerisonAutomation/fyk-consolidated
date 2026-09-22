import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { ReportForm } from "@/components/report/report-form";
import { REPORT_TARGET_TYPES, type ReportTargetType } from "@/lib/report-reasons";

/**
 * `/report-user` — file a report against one person or one of their things.
 *
 * The generated screen here fetched `/api/report-user` and posted to
 * `/api/report-user/{id}/action`; neither exists, and a report form rendered as a list of
 * cards cannot be used — there is nothing to select and nowhere to write. The form is
 * `#/components/report/report-form`, and the route it writes is
 * `#/routes/api/safety/reports`.
 *
 * WHO IS BEING REPORTED
 * ---------------------
 * `?userId=` names them, and `?targetType=` narrows it to a message, event, board post or
 * album. Without an id the screen says so rather than showing a form that would 400 on
 * submit — the route requires `reportedId` and refuses to guess.
 */
export const Route = createFileRoute("/report-user/")({
	component: ReportUserScreen,
	validateSearch: (
		search: Record<string, unknown>,
	): { userId?: string; targetType?: ReportTargetType } => {
		const userId = typeof search.userId === "string" ? search.userId : undefined;
		const targetType = (REPORT_TARGET_TYPES as readonly string[]).includes(
			String(search.targetType),
		)
			? (search.targetType as ReportTargetType)
			: undefined;
		return { userId, targetType };
	},
});

function ReportUserScreen() {
	const { userId, targetType } = Route.useSearch();

	if (!userId) {
		return (
			<div className="mx-auto max-w-md p-4 pb-24">
				<div className="rounded-[20px] border border-black/[0.06] bg-white p-6 text-center shadow-sm">
					<ShieldAlert className="mx-auto h-8 w-8 text-zinc-400" />
					<h1 className="font-display mt-3 text-[20px] font-bold text-black">
						Nobody selected
					</h1>
					<p className="mt-1 text-[13px] text-zinc-500">
						A report names the profile it is about. Open the profile and use Report,
						or arrive here with <code>?userId=</code>.
					</p>
					<Link
						to="/safety"
						className="mt-4 inline-block rounded-full bg-black px-4 py-2 text-[13px] text-white"
					>
						Safety centre
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-md p-4 pb-24">
			<ReportForm reportedId={userId} targetType={targetType ?? "profile"} />
			<p className="mt-4 text-[11px] text-zinc-500">
				Writes <code>POST /api/safety/reports</code>
				{targetType && targetType !== "profile" ? ` against a ${targetType}` : ""}. A
				duplicate — the same reason, the same profile, still open — folds into the
				first report instead of making a second one.
			</p>
		</div>
	);
}
