import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	Archive,
	Ban,
	Check,
	Copy,
	ImagePlus,
	Loader2,
	Pencil,
	Pin,
	PinOff,
	RefreshCw,
	Reply,
	SendHorizontal,
	ShieldAlert,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShell } from "#/components/AppShell";
import { ReportDialog } from "#/components/ReportDialog";
import { Avatar } from "#/components/ui/Avatar";
import { MediaImage } from "#/components/ui/MediaImage";
import { describeFailure, StateBlock } from "#/components/ui/StateBlock";
import type {
	MessageActionAck,
	MessageEditAck,
	MessagePage,
	MessageRow,
	PublicProfile,
	SendMessageAck,
} from "#/lib/api-types";
import { ApiClientError, api } from "#/lib/client";
import { useLongPress } from "#/lib/hooks/use-long-press";
import { useToasts } from "#/lib/toast";
import { cn, timeAgo } from "#/lib/utils";

export const Route = createFileRoute("/chat/$conversationId/")({
	component: ConversationPage,
	head: () => ({
		meta: [{ title: "Chat — FYK" }, { name: "robots", content: "noindex" }],
	}),
});

const EMOJI = [
	{ id: "heart", glyph: "❤️", label: "Heart" },
	{ id: "fire", glyph: "🔥", label: "Fire" },
	{ id: "laugh", glyph: "😂", label: "Laugh" },
	{ id: "wow", glyph: "😮", label: "Surprise" },
	{ id: "like", glyph: "👍", label: "Like" },
] as const;

type Pending = {
	key: string;
	body: string;
	mediaPath?: string;
	mediaKind?: "image" | "video" | "audio";
	previewUrl?: string | null;
	failed?: boolean;
	replyToId?: string | null;
};

const draftKey = (id: string) => `fyk:draft:${id}`;

/** One definition of the cache key, so a write cannot patch a page nobody reads. */
const MESSAGES_KEY = (id: string) => ["messages", id] as const;

function ConversationPage() {
	const { conversationId } = Route.useParams();
	const { session, capable } = useShell();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const push = useToasts((state) => state.push);

	const [text, setText] = useState(() => readDraft(conversationId));
	const [attachment, setAttachment] = useState<{
		path: string;
		kind: "image" | "video" | "audio";
		previewUrl: string | null;
		uploading: boolean;
	} | null>(null);
	const [pending, setPending] = useState<Pending[]>([]);
	const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
	const [editing, setEditing] = useState<MessageRow | null>(null);
	const [menuFor, setMenuFor] = useState<string | null>(null);
	const [reportTarget, setReportTarget] = useState<MessageRow | null>(null);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const endRef = useRef<HTMLDivElement | null>(null);
	const scrollerRef = useRef<HTMLDivElement | null>(null);
	const fileRef = useRef<HTMLInputElement | null>(null);

	const messages = useQuery({
		queryKey: MESSAGES_KEY(conversationId),
		queryFn: () =>
			api.get<MessagePage>(`conversations/${conversationId}/messages`),
		enabled: capable("chat"),
		// Polling is the honest word for this: there is no push channel in this
		// build, so a new message lands on the next tick while the tab is open.
		refetchInterval: 8_000,
		refetchIntervalInBackground: false,
	});

	const list = messages.data?.messages ?? [];
	const me = session.userId;

	/**
	 * Every write below goes through the cache first. Two rules keep that honest:
	 * the optimistic value must be exactly what the server's own projection will
	 * answer (so the row does not change again a second later), and the previous
	 * page is restored if the request fails. Where the server answer carries
	 * information the client cannot invent — who else reacted, whether the pin limit
	 * was hit — a settle-time invalidation reconciles after the paint.
	 */
	const patchMessage = (
		id: string,
		patch: (message: MessageRow) => MessageRow,
	) =>
		queryClient.setQueryData<MessagePage>(
			MESSAGES_KEY(conversationId),
			(current) =>
				current
					? {
							...current,
							messages: current.messages.map((message) =>
								message.id === id ? patch(message) : message,
							),
						}
					: current,
		);
	const snapshotPage = () =>
		queryClient.getQueryData<MessagePage>(MESSAGES_KEY(conversationId));
	const restorePage = (page: MessagePage | undefined) => {
		if (page) queryClient.setQueryData(MESSAGES_KEY(conversationId), page);
	};
	const invalidateMessages = () =>
		void queryClient.invalidateQueries({
			queryKey: MESSAGES_KEY(conversationId),
		});

	const loadOlder = async () => {
		const oldest = list[0];
		if (!oldest) return;
		setLoadingOlder(true);
		try {
			const page = await api.get<MessagePage>(
				`conversations/${conversationId}/messages?before=${encodeURIComponent(oldest.createdAt)}`,
			);
			// Merging into the cache keeps scroll position instead of jumping to the
			// bottom the way a naive refetch would.
			queryClient.setQueryData<MessagePage>(
				["messages", conversationId],
				(current) =>
					current
						? {
								...current,
								messages: [...page.messages, ...current.messages],
								hasMore: page.hasMore,
							}
						: page,
			);
		} catch (error) {
			push(
				error instanceof Error
					? error.message
					: "Older messages could not load.",
				"error",
			);
		} finally {
			setLoadingOlder(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed to the *counts* on purpose — a refetch that returns the same messages must not move the scroll, and depending on `list`/`pending` would.
	useEffect(() => {
		if (messages.isPending) return;
		const node = scrollerRef.current;
		if (!node) return;
		// Only stick to the bottom when the user is already near it, so reading
		// history is not yanked away by their own typing.
		const nearBottom =
			node.scrollHeight - node.scrollTop - node.clientHeight < 220;
		if (nearBottom) endRef.current?.scrollIntoView({ block: "end" });
	}, [list.length, pending.length, messages.isPending]);

	useEffect(() => {
		writeDraft(conversationId, text);
	}, [conversationId, text]);

	const send = useMutation({
		mutationFn: (payload: Pending) =>
			api.post<SendMessageAck>(`conversations/${conversationId}/messages`, {
				body: payload.body || undefined,
				mediaPath: payload.mediaPath,
				mediaKind: payload.mediaKind,
				replyToId: payload.replyToId ?? undefined,
				idempotencyKey: payload.key,
			}),
		onSuccess: (_result, payload) => {
			setPending((current) =>
				current.filter((entry) => entry.key !== payload.key),
			);
			invalidateMessages();
			void queryClient.invalidateQueries({ queryKey: ["conversations"] });
		},
		onError: (error, payload) => {
			setPending((current) =>
				current.map((entry) =>
					entry.key === payload.key ? { ...entry, failed: true } : entry,
				),
			);
			void push(
				error instanceof ApiClientError
					? error.message
					: "That message did not send.",
				"error",
			);
		},
	});

	const edit = useMutation({
		mutationFn: ({ id, value }: { id: string; value: string }) =>
			api.patch<MessageEditAck>(`messages/${id}`, {
				action: "edit",
				value: value.slice(0, 4000),
			}),
		onMutate: ({ id, value }) => {
			const previous = snapshotPage();
			patchMessage(id, (message) => ({
				...message,
				body: value,
				// The projection the list uses sets both of these from the row, and a
				// second edit is refused — so the optimistic row must already say so.
				edited: true,
				editedAt: new Date().toISOString(),
				canEdit: false,
			}));
			return { previous };
		},
		onError: (error, _variables, context) => {
			restorePage(context?.previous);
			push(
				error instanceof Error ? error.message : "That edit did not save.",
				"error",
			);
		},
	});

	const submit = useCallback(() => {
		if (editing) {
			const value = text.trim();
			if (!value) return;
			edit.mutate({ id: editing.id, value });
			setEditing(null);
			return;
		}
		const body = text.trim();
		if (!body && !attachment) return;
		if (attachment?.uploading) {
			push("That photo is still uploading — one moment.", "info");
			return;
		}
		const entry: Pending = {
			key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
			body,
			mediaPath: attachment?.path,
			mediaKind: attachment?.kind,
			previewUrl: attachment?.previewUrl,
			replyToId: replyTo?.id ?? null,
		};
		setPending((current) => [...current, entry]);
		setText("");
		setAttachment(null);
		setReplyTo(null);
		send.mutate(entry);
	}, [attachment, edit, editing, push, replyTo, send, text]);

	const act = useMutation({
		mutationFn: ({
			id,
			action,
		}: {
			id: string;
			action: "recall" | "pin" | "unpin";
		}) => api.patch<MessageActionAck>(`messages/${id}`, { action }),
		onMutate: ({ id, action }) => {
			const previous = snapshotPage();
			if (action === "recall") {
				// Mirrors the read projection exactly, including the file: a recalled
				// photo has its signed URL dropped server-side, so the cache must not
				// keep showing it while the server has stopped handing it out.
				patchMessage(id, (message) => ({
					...message,
					recalled: true,
					body: null,
					mediaUrl: null,
					mediaExpiresIn: null,
					canEdit: false,
					canRecall: false,
				}));
			} else {
				const pinnedAt = action === "pin" ? new Date().toISOString() : null;
				patchMessage(id, (message) => ({ ...message, pinnedAt }));
			}
			return { previous };
		},
		onSuccess: (_result, variables) => {
			if (variables.action === "recall") push("Message recalled.", "success");
			// The pinned strip at the top of the thread is a separate list in the same
			// page, so it is reconciled from the server rather than guessed at here.
			invalidateMessages();
		},
		onError: (error, _variables, context) => {
			restorePage(context?.previous);
			push(
				error instanceof Error ? error.message : "That did not work.",
				"error",
			);
		},
	});

	const react = useMutation({
		mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
			api.post<{ active: boolean }>(`messages/${id}/react`, { emoji }),
		onMutate: ({ id, emoji }) => {
			const previous = snapshotPage();
			patchMessage(id, (message) => {
				const existing = message.reactions.find(
					(reaction) => reaction.emoji === emoji,
				);
				// The endpoint toggles and answers `{ active }`; the only part of the
				// row that is ours to change is our own vote, so that is all this guesses.
				const mine = !(existing?.mine ?? false);
				const count = (existing?.count ?? 0) + (mine ? 1 : -1);
				if (count <= 0)
					return {
						...message,
						reactions: message.reactions.filter(
							(reaction) => reaction.emoji !== emoji,
						),
					};
				return {
					...message,
					reactions: existing
						? message.reactions.map((reaction) =>
								reaction.emoji === emoji
									? { ...reaction, mine, count }
									: reaction,
							)
						: [...message.reactions, { emoji, count, mine }],
				};
			});
			return { previous };
		},
		onError: (error, _variables, context) => {
			restorePage(context?.previous);
			push(
				error instanceof Error ? error.message : "That reaction did not save.",
				"error",
			);
		},
		// No invalidation on success: the toggle above is the server's own answer for
		// my vote, and refetching would blink the row the user just tapped. Anyone
		// else's reactions arrive with the next poll.
	});

	const block = useMutation({
		mutationFn: () =>
			api.post<{ blocked: boolean }>("blocks", { targetId: otherId }),
		onSuccess: () => {
			push("Blocked. They can no longer see you or message you.", "success");
			invalidateMessages();
			void queryClient.invalidateQueries({ queryKey: ["conversations"] });
		},
		onError: (error) =>
			push(
				error instanceof Error ? error.message : "That did not work.",
				"error",
			),
	});

	const archive = useMutation({
		mutationFn: () =>
			api.patch<{ archived: boolean }>(`conversations/${conversationId}`, {
				archived: true,
			}),
		onSuccess: () => {
			push(
				"Archived. It is out of your inbox; the other person is not told.",
				"success",
			);
			void queryClient.invalidateQueries({ queryKey: ["conversations"] });
			void navigate({ to: "/chat" });
		},
		onError: (error) =>
			push(
				error instanceof Error ? error.message : "That did not work.",
				"error",
			),
	});

	const pickFile = async (file: File) => {
		const form = new FormData();
		form.append("file", file);
		form.append("conversationId", conversationId);
		setAttachment({
			path: "",
			kind: "image",
			previewUrl: URL.createObjectURL(file),
			uploading: true,
		});
		try {
			const result = await api.postForm<{
				storagePath: string;
				kind: "image" | "video" | "audio";
				previewUrl: string | null;
			}>("media/chat", form);
			setAttachment({
				path: result.storagePath,
				kind: result.kind,
				previewUrl: result.previewUrl ?? URL.createObjectURL(file),
				uploading: false,
			});
		} catch (error) {
			setAttachment(null);
			push(
				error instanceof Error ? error.message : "That upload failed.",
				"error",
			);
		} finally {
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	// The peer comes from the inbox query, which this page shares through the
	// cache — one request either way, and the header cannot disagree with the list.
	const inbox = useQuery({
		queryKey: ["conversations"],
		queryFn: () =>
			api.get<{ conversations: { id: string; other: PublicProfile | null }[] }>(
				"conversations",
			),
		enabled: capable("chat"),
		staleTime: 60_000,
	});
	const otherProfile =
		(inbox.data?.conversations ?? []).find((row) => row.id === conversationId)
			?.other ?? null;
	const otherId = otherProfile?.id ?? "";

	const failure = messages.error ? describeFailure(messages.error) : null;
	const pinned = messages.data?.pinned ?? [];
	const activePin = pinned[pinned.length - 1];

	return (
		<div className="flex h-[calc(100svh-8.5rem)] flex-col md:h-[calc(100svh-3rem)]">
			<header className="flex items-center gap-3 border-b border-line pb-3">
				<button
					type="button"
					onClick={() => void navigate({ to: "/chat" })}
					className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink md:hidden"
					aria-label="Back to chats"
				>
					<X className="h-5 w-5" />
				</button>
				<Avatar
					name={otherProfile?.displayName ?? "Conversation"}
					photoUrl={otherProfile?.avatarUrl ?? null}
					size={38}
					online={otherProfile?.presence === "online"}
				/>
				<div className="min-w-0 flex-1">
					{/* The peer's name is the page title: detail screens get no heading from
					    the shell, so without this one a screen reader lands on a bare list. */}
					<h1 className="truncate text-[14.5px] font-semibold">
						{otherProfile?.displayName ?? "This conversation"}
					</h1>
					<p className="text-[11.5px] text-muted">
						{otherProfile
							? `${
									otherProfile.presence === "online"
										? "Online now"
										: `Last seen ${timeAgo(otherProfile.lastActiveAt)}`
								} · refreshed while open`
							: "Membership only"}
					</p>
				</div>
				{activePin && (
					<div className="hidden max-w-[240px] items-center gap-1.5 rounded-full border border-gold/30 bg-gold-ghost px-2.5 py-1 text-[11.5px] text-gold sm:flex">
						<Pin className="h-3 w-3" />
						<span className="truncate">
							{activePin.body ?? "Pinned message"}
						</span>
					</div>
				)}
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onClick={() => void messages.refetch()}
						className="press grid h-9 w-9 place-items-center rounded-full text-muted hover:text-ink"
						aria-label="Refresh messages"
					>
						<RefreshCw
							className={cn("h-4 w-4", messages.isFetching && "animate-spin")}
						/>
					</button>
					<button
						type="button"
						onClick={() => archive.mutate()}
						className="press grid h-9 w-9 place-items-center rounded-full text-muted hover:text-ink"
						aria-label="Archive this conversation"
					>
						<Archive className="h-4 w-4" />
					</button>
				</div>
			</header>

			<div
				ref={scrollerRef}
				className="fyk-scroll -mx-1 flex-1 overflow-y-auto px-1 py-4"
			>
				{messages.isPending ? (
					<StateBlock kind="loading" title="Loading messages" />
				) : failure ? (
					<StateBlock
						kind="error"
						title="This thread could not load"
						description={failure.message}
						action={
							<button
								type="button"
								onClick={() => void messages.refetch()}
								className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black"
							>
								Try again
							</button>
						}
					/>
				) : (
					<>
						{messages.data?.hasMore ? (
							<button
								type="button"
								onClick={() => void loadOlder()}
								disabled={loadingOlder}
								className="press mx-auto mb-4 flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-muted hover:text-ink"
							>
								{loadingOlder ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<ChevronUp />
								)}
								Load earlier messages
							</button>
						) : (
							<p className="mb-4 text-center text-[11.5px] text-faint">
								This is the start of your conversation.
							</p>
						)}

						<ul className="space-y-1.5">
							{list.map((message, index) => (
								<MessageBubble
									key={message.id}
									message={message}
									previous={list[index - 1]}
									meId={me ?? ""}
									open={menuFor === message.id}
									onOpenMenu={() => setMenuFor(message.id)}
									onCloseMenu={() => setMenuFor(null)}
									onReact={(emoji) => react.mutate({ id: message.id, emoji })}
									onReply={() => {
										setReplyTo(message);
										setMenuFor(null);
									}}
									onEdit={() => {
										setEditing(message);
										setText(message.body ?? "");
										setMenuFor(null);
									}}
									onRecall={() => {
										act.mutate({ id: message.id, action: "recall" });
										setMenuFor(null);
									}}
									onPin={() => {
										act.mutate({
											id: message.id,
											action: message.pinnedAt ? "unpin" : "pin",
										});
										setMenuFor(null);
									}}
									onReport={() => {
										setReportTarget(message);
										setMenuFor(null);
									}}
									onBlock={() => {
										if (
											window.confirm(
												"Block this person? They will not be told.",
											)
										)
											block.mutate();
										setMenuFor(null);
									}}
									canBlock={Boolean(otherId)}
								/>
							))}

							{pending.map((entry) => (
								<li
									key={entry.key}
									className={cn(
										"flex",
										entry.body ? "justify-end" : "justify-end",
									)}
								>
									<div
										className={cn(
											"max-w-[78%] rounded-2xl border px-3.5 py-2",
											entry.failed
												? "border-live/40 bg-live/10"
												: "border-line bg-surface opacity-80",
										)}
									>
										{entry.previewUrl && (
											<MediaImage
												src={entry.previewUrl}
												alt=""
												ratio="4 / 3"
												className="mb-1.5 w-full rounded-xl"
											/>
										)}
										{entry.body && (
											<p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink">
												{entry.body}
											</p>
										)}
										<p className="mt-1 flex items-center gap-1.5 text-[11px]">
											{entry.failed ? (
												<>
													<AlertCircle className="h-3 w-3 text-live" />
													<span className="text-live">Not delivered</span>
													<button
														type="button"
														onClick={() => {
															setPending((current) =>
																current.filter(
																	(item) => item.key !== entry.key,
																),
															);
															send.mutate(entry);
														}}
														className="font-semibold text-gold hover:underline"
													>
														Retry
													</button>
													<button
														type="button"
														onClick={() =>
															setPending((current) =>
																current.filter(
																	(item) => item.key !== entry.key,
																),
															)
														}
														className="text-faint hover:text-ink"
													>
														Discard
													</button>
												</>
											) : (
												<span className="inline-flex items-center gap-1 text-faint">
													<Loader2 className="h-3 w-3 animate-spin" /> Sending
												</span>
											)}
										</p>
									</div>
								</li>
							))}
						</ul>
						<div ref={endRef} />
					</>
				)}
			</div>

			{activePin && (
				<div className="mb-2 flex items-center gap-2 rounded-xl border border-gold/25 bg-gold-ghost px-3 py-2 text-[12.5px] text-gold sm:hidden">
					<Pin className="h-3.5 w-3.5 shrink-0" />
					<span className="truncate">{activePin.body ?? "Pinned message"}</span>
					<button
						type="button"
						onClick={() =>
							act.mutate({ id: String(activePin.id), action: "unpin" })
						}
						className="ml-auto shrink-0"
						aria-label="Unpin message"
					>
						<PinOff className="h-3.5 w-3.5" />
					</button>
				</div>
			)}

			{replyTo && (
				<div className="mb-2 flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2">
					<Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
					<p className="line-clamp-2 flex-1 text-[12.5px] text-muted">
						{replyTo.body ?? "Attachment"}
					</p>
					<button
						type="button"
						onClick={() => setReplyTo(null)}
						className="shrink-0 text-faint hover:text-ink"
						aria-label="Cancel reply"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			{editing && (
				<div className="mb-2 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-ghost px-3 py-2 text-[12.5px] text-gold">
					<Pencil className="h-3.5 w-3.5" /> Editing a message
					<button
						type="button"
						onClick={() => {
							setEditing(null);
							setText("");
						}}
						className="ml-auto underline"
					>
						Cancel
					</button>
				</div>
			)}

			{attachment && (
				<div className="mb-2 flex items-center gap-3 rounded-xl border border-line bg-surface p-2">
					{attachment.previewUrl ? (
						<MediaImage
							src={attachment.previewUrl}
							alt=""
							ratio="1 / 1"
							className="h-14 w-14 rounded-lg"
							label="Preview unavailable"
						/>
					) : (
						<span className="grid h-14 w-14 place-items-center rounded-lg border border-line text-[10px] text-faint">
							{attachment.kind}
						</span>
					)}
					<span className="flex-1 text-[12.5px] text-muted">
						{attachment.uploading ? (
							<span className="inline-flex items-center gap-1.5">
								<Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
							</span>
						) : (
							<span className="inline-flex items-center gap-1.5 text-emerald-300">
								<Check className="h-3.5 w-3.5" /> Ready to send
							</span>
						)}
					</span>
					<button
						type="button"
						onClick={() => setAttachment(null)}
						className="press grid h-8 w-8 place-items-center rounded-full text-faint hover:text-live"
						aria-label="Remove attachment"
					>
						<Trash2 className="h-4 w-4" />
					</button>
				</div>
			)}

			<form
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
				className="flex items-end gap-2"
			>
				<input
					ref={fileRef}
					type="file"
					accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
					className="sr-only"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file) void pickFile(file);
					}}
				/>
				<button
					type="button"
					onClick={() => fileRef.current?.click()}
					className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink"
					aria-label="Attach a photo or video"
				>
					<ImagePlus className="h-5 w-5" />
				</button>
				<label className="relative flex-1">
					<span className="sr-only">Message</span>
					<textarea
						value={text}
						onChange={(event) => setText(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								submit();
							}
						}}
						rows={1}
						maxLength={4000}
						placeholder={
							otherProfile
								? `Message ${otherProfile.displayName.split(" ")[0]}`
								: "Write a message"
						}
						className="entry-input max-h-32 min-h-12 resize-none py-3 text-[14.5px]"
					/>
					<span className="pointer-events-none absolute bottom-1.5 right-2.5 text-[10.5px] text-faint">
						{text.length > 3500 ? `${4000 - text.length} left` : ""}
					</span>
				</label>
				<button
					type="submit"
					disabled={!text.trim() && !attachment}
					className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-black disabled:opacity-40"
					aria-label={editing ? "Save edit" : "Send message"}
				>
					{editing ? (
						<Pencil className="h-5 w-5" />
					) : send.isPending ? (
						<Loader2 className="h-5 w-5 animate-spin" />
					) : (
						<SendHorizontal className="h-5 w-5" />
					)}
				</button>
			</form>

			{reportTarget && (
				<ReportDialog
					targetType="message"
					targetId={reportTarget.id}
					targetLabel={(reportTarget.body ?? "a message").slice(0, 40)}
					onClose={() => setReportTarget(null)}
				/>
			)}
		</div>
	);
}

function MessageBubble({
	message,
	previous,
	meId,
	open,
	onOpenMenu,
	onCloseMenu,
	onReact,
	onReply,
	onEdit,
	onRecall,
	onPin,
	onReport,
	onBlock,
	canBlock,
}: {
	message: MessageRow;
	previous?: MessageRow;
	meId: string;
	open: boolean;
	onOpenMenu: () => void;
	onCloseMenu: () => void;
	onReact: (emoji: string) => void;
	onReply: () => void;
	onEdit: () => void;
	onRecall: () => void;
	onPin: () => void;
	onReport: () => void;
	onBlock: () => void;
	canBlock: boolean;
}) {
	const longPress = useLongPress(onOpenMenu, 380);
	const grouped =
		previous?.senderId === message.senderId &&
		Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 5 * 60_000;

	if (message.recalled) {
		return (
			<li className="py-1 text-center">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] text-faint">
					<Trash2 className="h-3 w-3" />{" "}
					{message.mine ? "You recalled a message" : "A message was recalled"}
				</span>
			</li>
		);
	}

	return (
		<li
			className={cn(
				"group relative flex",
				message.mine ? "justify-end" : "justify-start",
			)}
			{...longPress}
		>
			<div className={cn("relative max-w-[80%]")}>
				<button
					type="button"
					onClick={open ? onCloseMenu : onOpenMenu}
					onContextMenu={(event) => {
						event.preventDefault();
						onOpenMenu();
					}}
					className={cn(
						"block w-full rounded-2xl px-3.5 py-2 text-left",
						message.mine
							? "bg-gold text-black"
							: "border border-line bg-surface text-ink",
						!message.mine && grouped && "border-t-transparent",
					)}
				>
					{message.mediaUrl ? (
						message.type === "video" ? (
							<ChatVideo src={message.mediaUrl} />
						) : (
							<MediaImage
								key={message.mediaUrl}
								src={message.mediaUrl}
								alt=""
								ratio="4 / 3"
								className="mb-1.5 w-full max-h-80 rounded-xl"
								label="This photo could not be loaded"
							/>
						)
					) : null}
					{message.body && (
						<p className="whitespace-pre-line break-words text-[14.5px] leading-relaxed">
							{message.body}
						</p>
					)}
					{message.replyToId && (
						<span className="mt-1 block text-[11px] opacity-70">
							Replying to a message
						</span>
					)}
					<span
						className={cn(
							"mt-1 flex items-center gap-1.5 text-[10.5px]",
							message.mine ? "text-black/60" : "text-faint",
						)}
					>
						{timeAgo(message.createdAt)}
						{message.edited ? " · edited" : ""}
						{message.pinnedAt ? " · pinned" : ""}
						{message.mediaUrl && message.mediaExpiresIn
							? ` · file link expires in ${Math.round(message.mediaExpiresIn / 60)} min`
							: ""}
					</span>
				</button>

				{message.reactions.length > 0 && (
					<div
						className={cn(
							"mt-1 flex flex-wrap gap-1",
							message.mine && "justify-end",
						)}
					>
						{message.reactions.map((reaction) => (
							<button
								key={reaction.emoji}
								type="button"
								onClick={() => onReact(reaction.emoji)}
								className={cn(
									"press flex h-6 items-center gap-1 rounded-full border px-1.5 text-[11px]",
									reaction.mine
										? "border-gold/60 bg-gold/10 text-gold"
										: "border-line bg-surface-2 text-muted",
								)}
								aria-label={`${reaction.count} ${
									EMOJI.find((entry) => entry.id === reaction.emoji)?.label ??
									"reaction"
								}${reaction.count === 1 ? "" : "s"}${
									reaction.mine ? " — yours, tap to remove" : ""
								}`}
							>
								<span>
									{EMOJI.find((entry) => entry.id === reaction.emoji)?.glyph ??
										"•"}
								</span>
								{reaction.count}
							</button>
						))}
					</div>
				)}

				{open && (
					<MessageMenu
						message={message}
						meId={meId}
						canBlock={canBlock}
						onClose={onCloseMenu}
						onReact={onReact}
						onReply={onReply}
						onEdit={onEdit}
						onRecall={onRecall}
						onPin={onPin}
						onReport={onReport}
						onBlock={onBlock}
					/>
				)}
			</div>
		</li>
	);
}

function MessageMenu({
	message,
	meId,
	canBlock,
	onClose,
	onReact,
	onReply,
	onEdit,
	onRecall,
	onPin,
	onReport,
	onBlock,
}: {
	message: MessageRow;
	meId: string;
	canBlock: boolean;
	onClose: () => void;
	onReact: (emoji: string) => void;
	onReply: () => void;
	onEdit: () => void;
	onRecall: () => void;
	onPin: () => void;
	onReport: () => void;
	onBlock: () => void;
}) {
	const mine = message.senderId === meId;
	const containerRef = useRef<HTMLDivElement | null>(null);

	// A context menu opened by long-press or right-click has no keyboard story
	// unless it builds one: focus arrives, Arrow keys walk the items, Escape and a
	// click anywhere outside dismiss it. `tabIndex={-1}` on the items keeps Tab
	// leaving the menu instead of trapping a keyboard user inside a popover.
	useEffect(() => {
		const container = containerRef.current;
		const items = () =>
			[
				...(container?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? []),
			].filter((node) => !node.hasAttribute("disabled"));

		items()[0]?.focus({ preventScroll: true });

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
				return;
			}
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
			const list = items();
			if (list.length === 0) return;
			event.preventDefault();
			const at = list.indexOf(document.activeElement as HTMLElement);
			const step = event.key === "ArrowDown" ? 1 : -1;
			const next = (at + step + list.length) % list.length;
			list[next]?.focus({ preventScroll: true });
		};
		const onPointerDown = (event: PointerEvent) => {
			if (container?.contains(event.target as Node)) return;
			onClose();
		};

		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [onClose]);

	return (
		<div
			ref={containerRef}
			role="menu"
			aria-label="Message actions"
			className="absolute top-full z-30 mt-1 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
			onClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => event.stopPropagation()}
		>
			<div className="flex justify-between gap-1 border-b border-line-soft px-1.5 pb-1.5 pt-0.5">
				{EMOJI.map((emoji) => (
					<button
						key={emoji.id}
						type="button"
						role="menuitem"
						tabIndex={-1}
						data-menu-item
						title={emoji.label}
						onClick={() => {
							onReact(emoji.id);
							onClose();
						}}
						className="press grid h-8 w-8 place-items-center rounded-lg text-[16px] hover:bg-surface-2"
					>
						{emoji.glyph}
					</button>
				))}
			</div>
			<button
				type="button"
				role="menuitem"
				tabIndex={-1}
				data-menu-item
				className="menu-item"
				onClick={onReply}
			>
				<Reply className="h-4 w-4" /> Reply
			</button>
			{message.body ? (
				<button
					type="button"
					role="menuitem"
					tabIndex={-1}
					data-menu-item
					className="menu-item"
					onClick={() => {
						// Copying is only offered when there is text; an attachment alone
						// has nothing to put on the clipboard.
						void navigator.clipboard?.writeText(message.body ?? "");
						onClose();
					}}
				>
					<Copy className="h-4 w-4" /> Copy text
				</button>
			) : null}
			<button
				type="button"
				role="menuitem"
				tabIndex={-1}
				data-menu-item
				className="menu-item"
				onClick={() => {
					onPin();
				}}
			>
				{message.pinnedAt ? (
					<PinOff className="h-4 w-4" />
				) : (
					<Pin className="h-4 w-4" />
				)}{" "}
				{message.pinnedAt ? "Unpin" : "Pin to top"}
			</button>
			{mine ? (
				<>
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						data-menu-item
						className="menu-item"
						disabled={!message.canEdit}
						onClick={() => {
							onEdit();
						}}
						title={
							message.canEdit
								? undefined
								: "The 15 minute edit window has passed"
						}
					>
						<Pencil className="h-4 w-4" /> Edit
					</button>
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						data-menu-item
						className="menu-item text-live"
						disabled={!message.canRecall}
						onClick={() => {
							onRecall();
						}}
						title={
							message.canRecall
								? undefined
								: "Messages can be recalled within an hour"
						}
					>
						<Trash2 className="h-4 w-4" /> Recall
					</button>
				</>
			) : (
				<button
					type="button"
					role="menuitem"
					tabIndex={-1}
					data-menu-item
					className="menu-item"
					onClick={() => {
						onReport();
					}}
				>
					<ShieldAlert className="h-4 w-4" /> Report message
				</button>
			)}
			{!mine && canBlock && (
				<button
					type="button"
					role="menuitem"
					tabIndex={-1}
					data-menu-item
					className="menu-item"
					onClick={() => {
						onBlock();
					}}
				>
					<Ban className="h-4 w-4" /> Block
				</button>
			)}
		</div>
	);
}

/**
 * Video in a bubble is the sender’s own file, played inline and nothing more. There
 * is no caption track for it — the upload path never collects one — so the honest
 * control set is `controls` on a `playsInline` element rather than a fake transcript.
 */
function ChatVideo({ src }: { src: string }) {
	return (
		// biome-ignore lint/a11y/useMediaCaption: user-uploaded video has no caption track to attach.
		<video
			src={src}
			controls
			playsInline
			className="mb-1.5 max-h-72 w-full rounded-xl bg-black object-contain"
		/>
	);
}

function ChevronUp() {
	// The icon set is limited to what the app actually ships with; a plain arrow
	// reads better here than pulling another glyph in.
	return <span className="text-[13px] leading-none">↑</span>;
}

function readDraft(id: string): string {
	try {
		return localStorage.getItem(draftKey(id)) ?? "";
	} catch {
		return "";
	}
}

function writeDraft(id: string, value: string) {
	try {
		if (value) localStorage.setItem(draftKey(id), value);
		else localStorage.removeItem(draftKey(id));
	} catch {
		// Storage disabled: drafts simply do not persist.
	}
}
