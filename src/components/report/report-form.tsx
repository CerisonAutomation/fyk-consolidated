import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client";
import {
	MAX_DETAILS,
	REPORT_PROMISE,
	REPORT_REASONS,
	REPORT_TARGET_TYPES,
	type ReportTargetType,
} from "@/lib/report-reasons";

/**
 * The report form, once.
 *
 * `/report-user` had a generated screen that fetched `/api/report-user` — a route that
 * does not exist — and posted a card button to `/api/report-user/{id}/action`. A report
 * form that renders a list of items has nothing to select and nowhere to write, so the
 * one screen whose entire job is a text box did not have one.
 *
 * This talks to `#/routes/api/safety/reports`, which takes `{reportedId, reason,
 * details?, targetType}` (the reason list comes from `#/lib/report-reasons`, so the
 * form and the moderation queue agree on the strings) and answers with the report id.
 * It also offers to block the person, because that is the other half of what somebody
 * filing a harassment report wants and the two writes are separate rows.
 */

interface ReportResult {
	ok: boolean;
	id?: string;
	message?: string;
}

export function ReportForm({
	reportedId,
	targetType = "profile",
	onFiled,
}: {
	reportedId: string;
	targetType?: ReportTargetType;
	onFiled?: (result: ReportResult) => void;
}) {
	const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
	const [details, setDetails] = useState("");
	const [block, setBlock] = useState(true);
	const [filed, setFiled] = useState<ReportResult | null>(null);
	const [note, setNote] = useState<string | null>(null);

	const submit = useMutation({
		mutationFn: async () => {
			const result = await api<ReportResult>("/api/safety/reports", {
				method: "POST",
				body: {
					reportedId,
					reason,
					details: details.trim() || undefined,
					targetType,
				},
			});
			// Blocking is a second decision and a second row. If it fails the report is
			// still filed, so the failure is reported without pretending the report
			// did not happen.
			if (block) {
				try {
					await api("/api/social", {
						method: "POST",
						body: { targetId: reportedId, action: "block" },
					});
				} catch (error) {
					setNote(
						`Report filed. Blocking did not go through: ${
							error instanceof Error ? error.message : "unknown reason"
						}. You can block them from their profile.`,
					);
				}
			}
			return result;
		},
		onSuccess: (result) => {
			setFiled(result);
			onFiled?.(result);
		},
		onError: (error) =>
			setNote(
				error instanceof ApiError || error instanceof Error
					? error.message
					: "That did not go through. Try again.",
			),
	});

	if (filed) {
		return (
			<div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-6">
				<div className="flex items-center gap-3">
					<Flag className="h-5 w-5 text-emerald-700" />
					<h2 className="font-display text-[18px] font-bold text-emerald-900">
						Report {filed.id ? `#${filed.id.slice(0, 8)} ` : ""}filed
					</h2>
				</div>
				<p className="mt-2 text-[13px] text-emerald-800">{filed.message ?? "In the queue."}</p>
				<ul className="mt-3 space-y-1 text-[12px] text-emerald-800">
					{REPORT_PROMISE.map((line) => (
						<li key={line}>• {line}</li>
					))}
				</ul>
			</div>
		);
	}

	return (
		<form
			className="rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-sm"
			onSubmit={(event) => {
				event.preventDefault();
				submit.mutate();
			}}
		>
			<h2 className="font-display text-[20px] font-bold tracking-tight text-black">
				Report
			</h2>
			<p className="mt-1 text-[13px] text-zinc-500">
				Moderators read every report. The other person is not told.
			</p>

			{note && (
				<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
					{note}
				</output>
			)}

			<label className="mt-5 block text-[12px] font-medium text-zinc-600" htmlFor="reason">
				What is wrong
			</label>
			<select
				id="reason"
				value={reason}
				onChange={(event) => setReason(event.target.value)}
				className="mt-1 w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black"
			>
				{REPORT_REASONS.map((entry) => (
					<option key={entry.value} value={entry.value}>
						{entry.label}
					</option>
				))}
			</select>

			<label className="mt-4 block text-[12px] font-medium text-zinc-600" htmlFor="targetType">
				What it is about
			</label>
			<select
				id="targetType"
				defaultValue={targetType}
				className="mt-1 w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black"
			>
				{REPORT_TARGET_TYPES.map((type) => (
					<option key={type} value={type}>
						{type === "profile"
							? "Their profile"
							: type === "message"
								? "A message"
								: type === "event"
									? "An event"
									: type === "board"
										? "A board post"
										: "An album"}
					</option>
				))}
			</select>

			<label className="mt-4 block text-[12px] font-medium text-zinc-600" htmlFor="details">
				What happened <span className="text-zinc-400">(optional, {MAX_DETAILS} characters)</span>
			</label>
			<textarea
				id="details"
				value={details}
				rows={4}
				maxLength={MAX_DETAILS}
				onChange={(event) => setDetails(event.target.value)}
				placeholder="Dates, quotes, what was said — anything a moderator cannot see from the profile alone."
				className="mt-1 w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black"
			/>
			<p className="mt-1 text-right text-[11px] text-zinc-400">
				{details.length}/{MAX_DETAILS}
			</p>

			<label className="mt-4 flex items-start gap-2 text-[13px] text-zinc-700">
				<input
					type="checkbox"
					checked={block}
					onChange={(event) => setBlock(event.target.checked)}
					className="mt-0.5 h-4 w-4"
				/>
				Also block them, so nothing else arrives while this is reviewed.
			</label>

			<Button
				type="submit"
				disabled={submit.isPending}
				className="mt-5 w-full rounded-[12px] bg-black text-white disabled:opacity-60"
			>
				{submit.isPending ? "Filing…" : "File report"}
			</Button>

			<details className="mt-4 text-[12px] text-zinc-500">
				<summary className="cursor-pointer">What happens next</summary>
				<ul className="mt-2 space-y-1">
					{REPORT_PROMISE.map((line) => (
						<li key={line}>• {line}</li>
					))}
				</ul>
			</details>
		</form>
	);
}
