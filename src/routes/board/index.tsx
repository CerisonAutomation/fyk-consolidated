import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertCircle, Clock, Loader2, LogIn, MessageSquarePlus, RefreshCw, Send, ShieldAlert, Trash2, Users } from "lucide-react";
import { z } from "zod";
import { api } from "#/lib/client";
import type { BoardPage as BoardPageData, BoardPost } from "#/lib/api-types";
import { cn, timeAgo } from "#/lib/utils";
import { Avatar } from "#/components/ui/Avatar";
import { Chip } from "#/components/ui/Chip";
import { StateBlock, describeFailure } from "#/components/ui/StateBlock";
import { PullToRefresh } from "#/components/ui/PullToRefresh";
import { ReportDialog } from "#/components/ReportDialog";
import { useShell } from "#/components/AppShell";
import { useToasts } from "#/lib/toast";

export const Route = createFileRoute("/board/")({
	component: BoardPage,
	head: () => ({ meta: [{ title: "Board — FYK" }] }),
});

const KINDS = [
	{ id: "invite", label: "Invite", hint: "I'm doing something, come along" },
	{ id: "offer", label: "Offer", hint: "I have a spare / I can bring something" },
	{ id: "ask", label: "Ask", hint: "Looking for a person or a thing" },
	{ id: "text", label: "Just here", hint: "No plan yet, open to replies" },
] as const;

const composeSchema = z
	.object({
		kind: z.enum(["invite", "offer", "ask", "text"]),
		body: z.string().trim().min(3, "Say a bit more — at least 3 characters.").max(400),
		spots: z.number().int().min(1).max(50).nullable().optional(),
		windowMinutes: z.number().int().min(30).max(720),
	})
	.refine((value) => value.kind !== "invite" || value.spots != null, { message: "An invite needs a number of spots.", path: ["spots"] });

function BoardPage() {
	const { capable } = useShell();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const push = useToasts((state) => state.push);
	const [filter, setFilter] = useState<"all" | "invite" | "offer" | "ask">("all");
	const [composing, setComposing] = useState(false);
	const [reportTarget, setReportTarget] = useState<BoardPost | null>(null);
	const [now, setNow] = useState(() => Date.now());

	// A one-minute tick keeps the countdown real. Without it an expired post can
	// sit on screen looking live; the server already hides it from the list.
	useEffect(() => {
		const interval = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(interval);
	}, []);

	const { data, isPending, error, refetch, isFetching } = useQuery({
		queryKey: ["board", filter],
		queryFn: () => api.get<BoardPageData>(`board${filter === "all" ? "" : `?kind=${filter}`}`),
		enabled: capable("board"),
		staleTime: 15_000,
		refetchInterval: 60_000,
	});

	const join = useMutation({
		mutationFn: ({ postId, joining }: { postId: string; joining: boolean }) => api.post<{ joined: boolean; joinCount: number | null }>(`board/${postId}/join`, { joining }),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["board"] }),
		onError: (err) => push(err instanceof Error ? err.message : "That did not save.", "error"),
	});

	const remove = useMutation({
		mutationFn: (postId: string) => api.del<{ deleted: boolean }>(`board/${postId}`),
		onSuccess: () => {
			push("Post removed.", "success");
			void queryClient.invalidateQueries({ queryKey: ["board"] });
		},
		onError: (err) => push(err instanceof Error ? err.message : "That did not work.", "error"),
	});

	const failure = error ? describeFailure(error) : null;
	const posts = (data?.posts ?? []).filter((post) => Date.parse(post.expiresAt) > now);

	if (!capable("board")) {
		return <StateBlock kind="disabled" title="The Board is unavailable" description="board_posts is not readable for your account. Apply supabase/migrations/0006 and reload." />;
	}

	return (
		<>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				{(["all", "invite", "offer", "ask"] as const).map((kind) => (
					<Chip key={kind} active={filter === kind} onClick={() => setFilter(kind)}>
						{kind === "all" ? "Everything" : kind}
					</Chip>
				))}
				<button type="button" onClick={() => void refetch()} className={cn("press ml-auto flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold", isFetching ? "border-gold/60 bg-gold-ghost text-gold" : "border-line bg-surface text-ink-2")} aria-label="Refresh the Board">
					<RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
				</button>
				<button type="button" onClick={() => setComposing((value) => !value)} className="press flex h-9 items-center gap-1.5 rounded-full bg-gold px-3.5 text-[12.5px] font-bold text-black">
					<MessageSquarePlus className="h-3.5 w-3.5" />
					{composing ? "Close" : "Post"}
				</button>
			</div>

			{composing && <ComposeForm onDone={() => { setComposing(false); void queryClient.invalidateQueries({ queryKey: ["board"] }); }} />}

			<PullToRefresh onRefresh={async () => { await refetch(); }}>
				{isPending ? (
					<div className="space-y-3" aria-hidden="true">
						{[0, 1, 2, 3].map((index) => (
							<div key={index} className="skeleton h-28 rounded-2xl" />
						))}
					</div>
				) : failure ? (
					<StateBlock kind="error" title="The Board could not load" description={failure.message} action={<button type="button" onClick={() => void refetch()} className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black">Try again</button>} />
				) : posts.length === 0 ? (
					<StateBlock
						kind="empty"
						title={data?.note ?? "The Board is clear right now"}
						description="Board posts expire on purpose, so an empty Board usually means nobody nearby is out yet. Post something and it stays up for the window you choose."
						action={<button type="button" onClick={() => setComposing(true)} className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black">Start the Board</button>}
					/>
				) : (
					<ul className="space-y-3">
						{posts.map((post) => (
							<li key={post.id}>
								<BoardCard
									post={post}
									now={now}
									busy={join.isPending && join.variables?.postId === post.id}
									onJoin={() => join.mutate({ postId: post.id, joining: !post.joined })}
									onMessage={async () => {
										if (!post.author) return;
										try {
											const result = await api.post<{ conversationId: string }>("conversations", { targetId: post.author.id });
											void navigate({ to: "/chat/$conversationId", params: { conversationId: result.conversationId } });
										} catch (err) {
											push(err instanceof Error ? err.message : "You cannot message them yet.", "error");
										}
									}}
									onDelete={() => {
										if (window.confirm("Remove this post from the Board?")) remove.mutate(post.id);
									}}
									onReport={() => setReportTarget(post)}
								/>
							</li>
						))}
					</ul>
				)}
			</PullToRefresh>

			{reportTarget && (
				<ReportDialog
					targetType="board_post"
					targetId={reportTarget.id}
					targetLabel={reportTarget.body.slice(0, 40)}
					onClose={() => setReportTarget(null)}
				/>
			)}
		</>
	);
}

function ComposeForm({ onDone }: { onDone: () => void }) {
	const push = useToasts((state) => state.push);
	const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("invite");
	const [body, setBody] = useState("");
	const [spots, setSpots] = useState("2");
	const [windowMinutes, setWindowMinutes] = useState(120);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const submit = async () => {
		setError("");
		const parsed = composeSchema.safeParse({ kind, body: body.trim(), spots: kind === "invite" ? Number(spots) : null, windowMinutes });
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		setBusy(true);
		try {
			await api.post<{ post: BoardPost }>("board", parsed.data);
			push("On the Board. It expires when the window ends.", "success");
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "That did not post.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
			className="anim-expand mb-4 rounded-2xl border border-line bg-surface p-4"
		>
			<div className="flex flex-wrap gap-1.5">
				{KINDS.map((entry) => (
					<Chip key={entry.id} active={kind === entry.id} onClick={() => setKind(entry.id)} title={entry.hint}>
						{entry.label}
					</Chip>
				))}
			</div>
			<p className="mt-2 text-[12px] text-faint">{KINDS.find((entry) => entry.id === kind)?.hint}</p>

			<label className="mt-3 block">
				<span className="sr-only">Board post text</span>
				<textarea
					value={body}
					onChange={(event) => setBody(event.target.value)}
					rows={3}
					maxLength={400}
					autoFocus
					placeholder="Be specific: where, when, how many. Vague posts get ignored."
					className="entry-input resize-none"
				/>
			</label>

			<div className="mt-3 flex flex-wrap items-center gap-4">
				{kind === "invite" && (
					<label className="flex items-center gap-2 text-[12.5px] text-ink-2">
						Spots
						<input type="number" min={1} max={50} value={spots} onChange={(event) => setSpots(event.target.value)} className="entry-input h-9 w-20" />
					</label>
				)}
				<label className="flex items-center gap-2 text-[12.5px] text-ink-2">
					Live for
					<select value={windowMinutes} onChange={(event) => setWindowMinutes(Number(event.target.value))} className="entry-input h-9 w-28">
						<option value={30}>30 min</option>
						<option value={60}>1 hour</option>
						<option value={120}>2 hours</option>
						<option value={240}>4 hours</option>
						<option value={720}>12 hours</option>
					</select>
				</label>
				<span className="ml-auto text-[11.5px] text-faint">{400 - body.length} left</span>
			</div>

			{error && (
				<p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-live/30 bg-live/10 px-3 py-2 text-[12.5px] text-live">
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
				</p>
			)}

			<button type="submit" disabled={busy} className="press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14px] font-bold text-black disabled:opacity-60">
				{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Put it on the Board
			</button>
		</form>
	);
}

function BoardCard({
	post,
	now,
	busy,
	onJoin,
	onMessage,
	onDelete,
	onReport,
}: {
	post: BoardPost;
	now: number;
	busy: boolean;
	onJoin: () => void;
	onMessage: () => void;
	onDelete: () => void;
	onReport: () => void;
}) {
	const msLeft = Date.parse(post.expiresAt) - now;
	const minutesLeft = Math.max(0, Math.round(msLeft / 60_000));
	const full = post.spots != null && post.joinCount >= post.spots;
	const expired = msLeft <= 0;

	return (
		<article className={cn("rounded-2xl border bg-surface p-4", post.joined ? "border-gold/40" : "border-line")}>
			<header className="flex items-start gap-3">
				<button type="button" onClick={onMessage} disabled={!post.author} className="shrink-0 disabled:cursor-default">
					<Avatar name={post.author?.displayName ?? "?"} photoUrl={post.author?.avatarUrl ?? null} size={40} online={post.author?.presence === "online"} />
				</button>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[14px] font-semibold">
						{post.author?.displayName ?? "Former member"}
						{post.isMine ? <span className="ml-1.5 text-[11px] font-medium text-muted">you</span> : null}
					</p>
					<p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
						<span className="uppercase tracking-wide text-gold">{post.kind}</span>
						<span className="inline-flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{expired ? "expired" : minutesLeft > 60 ? `${Math.round(minutesLeft / 60)} h left` : `${minutesLeft} min left`}
						</span>
						<span>{timeAgo(post.createdAt)}</span>
					</p>
				</div>
				{post.isMine ? (
					<button type="button" onClick={onDelete} className="press grid h-8 w-8 place-items-center rounded-full text-faint hover:text-live" aria-label="Remove your post">
						<Trash2 className="h-4 w-4" />
					</button>
				) : (
					<button type="button" onClick={onReport} className="press grid h-8 w-8 place-items-center rounded-full text-faint hover:text-live" aria-label="Report this post">
						<ShieldAlert className="h-4 w-4" />
					</button>
				)}
			</header>

			<p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{post.body}</p>

			<footer className="mt-3.5 flex flex-wrap items-center gap-2">
				{post.spots != null ? (
					<span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold", full ? "border-line text-faint" : "border-live/40 bg-live/10 text-live")}>
						<Users className="h-3.5 w-3.5" />
						{post.joinCount}/{post.spots}
					</span>
				) : null}

				{post.joiners.length > 0 && (
					<span className="flex items-center -space-x-1.5">
						{post.joiners.slice(0, 4).map((person) => (
							<Avatar key={person.id} name={person.displayName} photoUrl={person.avatarUrl} size={22} />
						))}
						{post.joiners.length > 4 ? <span className="pl-2.5 text-[11.5px] text-muted">+{post.joiners.length - 4}</span> : null}
					</span>
				)}

				<div className="ml-auto flex items-center gap-2">
					{post.isMine ? (
						post.author && post.joinCount > 0 ? (
							<span className="text-[12px] text-muted">{post.joinCount} joined — message them from your chats</span>
						) : (
							<span className="text-[12px] text-faint">Waiting for someone to join</span>
						)
					) : (
						<>
							{post.author && (
								<button type="button" onClick={onMessage} className="press h-9 rounded-full border border-line px-3 text-[12.5px] font-semibold text-ink-2 hover:text-ink">
									Message
								</button>
							)}
							<button
								type="button"
								onClick={onJoin}
								disabled={busy || expired || (full && !post.joined)}
								className={cn(
									"press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold disabled:opacity-50",
									post.joined ? "border border-gold/50 bg-gold-ghost text-gold" : "bg-gold text-black",
								)}
							>
								{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
								{post.joined ? "Joined" : full ? "Full" : "Join"}
							</button>
						</>
					)}
				</div>
			</footer>

			{full && !post.joined && <p className="mt-2 text-[11.5px] text-faint">The last spot went to someone else — capacity is enforced in the database, not on this screen.</p>}
		</article>
	);
}
