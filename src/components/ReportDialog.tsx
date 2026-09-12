/**
 * Reporting, from every surface that can produce a target.
 *
 * The confirm step is not decoration: FYK has no anonymous accusations, and a
 * report the user did not mean costs a moderator's time and can damage a member's
 * standing. That is why the copy states plainly that a real report follows.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { api } from "#/lib/client";
import { useToasts } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { Modal } from "./ui/Modal";

/** Mirrors `REPORT_REASONS` in src/server/handlers/safety.ts — do not drift. */
export const REPORT_REASONS = [
	{ id: "harassment", label: "Harassment or bullying" },
	{ id: "threat", label: "Threats of violence" },
	{ id: "doxxing", label: "Private details shared about me" },
	{ id: "underage", label: "Someone under 18" },
	{ id: "inappropriate_content", label: "Inappropriate content" },
	{ id: "fake_profile", label: "Fake or impersonation" },
	{ id: "spam", label: "Spam or scam" },
	{ id: "other", label: "Something else" },
] as const;

/** Kept in sync with URGENT_REASONS, which the database trigger also enforces. */
const URGENT = new Set(["underage", "threat", "doxxing"]);

const reportSchema = z
	.object({
		reason: z.string().min(1, "Pick the closest reason."),
		details: z.string().trim().max(1500).optional(),
		confirmed: z
			.boolean()
			.refine((value) => value, "Confirm that this is true before sending."),
	})
	.refine(
		(value) =>
			value.reason !== "other" || (value.details && value.details.length >= 10),
		{
			message:
				"For “something else”, add a sentence so a moderator knows what to look at.",
			path: ["details"],
		},
	);

export function ReportDialog({
	targetType,
	targetId,
	targetLabel,
	onAfterReport,
	onClose,
}: {
	targetType: "profile" | "message" | "board_post" | "event" | "album";
	targetId: string;
	targetLabel: string;
	onAfterReport?: () => void;
	onClose: () => void;
}) {
	const [reason, setReason] = useState("");
	const [details, setDetails] = useState("");
	const [confirmed, setConfirmed] = useState(false);
	const [fieldError, setFieldError] = useState("");
	const queryClient = useQueryClient();
	const push = useToasts((state) => state.push);

	const submit = useMutation({
		// The server answers with the report row and one authored sentence. We show
		// that sentence verbatim instead of promising outcomes FYK does not enforce.
		mutationFn: () =>
			api.post<{
				report: { id: string; status: string; severity: string };
				message: string;
			}>("reports", {
				targetType,
				targetId,
				reason,
				details: details.trim() || undefined,
				confirmed,
			}),
		onSuccess: (result) => {
			void queryClient.invalidateQueries({ queryKey: ["reports"] });
			push(result.message, "success");
			onAfterReport?.();
			onClose();
		},
		onError: (error) =>
			setFieldError(
				error instanceof Error
					? error.message
					: "The report did not send. Try again.",
			),
	});

	const urgent = URGENT.has(reason);

	return (
		<Modal open onClose={onClose} labelledBy="report-title">
			<div className="p-5 sm:p-6">
				<h2
					id="report-title"
					className="flex items-center gap-2 text-[17px] font-bold"
				>
					<ShieldAlert className="h-4.5 w-4.5 text-gold" />
					Report{" "}
					{targetType === "profile"
						? "member"
						: targetType === "message"
							? "message"
							: targetType === "board_post"
								? "post"
								: "event"}
				</h2>
				<p className="mt-1 text-[13px] text-muted">
					About <span className="font-semibold text-ink-2">{targetLabel}</span>.
					Reports are confidential — the other person is never told who reported
					them.
				</p>

				<fieldset className="mt-4 space-y-1.5">
					<legend className="mb-2 text-[12.5px] font-semibold text-ink-2">
						What happened?
					</legend>
					{REPORT_REASONS.map((entry) => (
						<button
							key={entry.id}
							type="button"
							onClick={() => {
								setReason(entry.id);
								setFieldError("");
							}}
							className={cn(
								"flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13.5px] transition-colors",
								reason === entry.id
									? "border-gold/60 bg-gold-ghost text-ink"
									: "border-line bg-surface-2 text-ink-2 hover:border-gold/30",
							)}
						>
							<span
								className={cn(
									"grid h-4 w-4 shrink-0 place-items-center rounded-full border",
									reason === entry.id ? "border-gold bg-gold" : "border-line",
								)}
							>
								{reason === entry.id && (
									<span className="h-1.5 w-1.5 rounded-full bg-black" />
								)}
							</span>
							{entry.label}
						</button>
					))}
				</fieldset>

				<label className="mt-4 block">
					<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
						What should a moderator know? (optional)
					</span>
					<textarea
						value={details}
						onChange={(event) => setDetails(event.target.value)}
						rows={3}
						maxLength={1500}
						placeholder="Dates, quotes, what was sent. Specifics get actioned faster."
						className="entry-input resize-none"
					/>
				</label>

				<label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3">
					<input
						type="checkbox"
						checked={confirmed}
						onChange={(event) => setConfirmed(event.target.checked)}
						className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]"
					/>
					<span className="text-[12.5px] leading-relaxed text-ink-2">
						This is true and I understand a false report is itself a violation.
					</span>
				</label>

				{urgent && (
					<p className="mt-3 flex items-start gap-2 rounded-xl border border-live/30 bg-live/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-live">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
						Reports like this one are flagged{" "}
						<span className="font-bold">urgent</span> by the database itself. If
						someone is in immediate danger, contact local emergency services
						first — FYK cannot dispatch anyone.
					</p>
				)}

				{fieldError && (
					<p className="mt-3 text-[12.5px] text-live">{fieldError}</p>
				)}

				<div className="mt-5 flex gap-2">
					<button
						type="button"
						onClick={onClose}
						className="press h-12 rounded-full border border-line px-5 text-[14px] font-semibold text-ink-2"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={submit.isPending}
						onClick={() => {
							const parsed = reportSchema.safeParse({
								reason,
								details: details.trim() || undefined,
								confirmed,
							});
							if (!parsed.success)
								return setFieldError(parsed.error.issues[0].message);
							setFieldError("");
							submit.mutate();
						}}
						className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-live text-[14.5px] font-bold text-black disabled:opacity-60"
					>
						{submit.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<ShieldAlert className="h-4 w-4" />
						)}
						Send report
					</button>
				</div>
			</div>
		</Modal>
	);
}
