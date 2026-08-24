import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "#/domains/auth/guard";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationsStore } from "#/domains/chat/store";
import { Drafts } from "#/domains/chat/drafts-store";
import {
	useConversationMessages,
	useSendMessage,
} from "#/core/api/hooks/use-messages";
import type { ApiResponseMessage } from "#/core/model/messages";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/chat/$conversationId/")({
	beforeLoad: requireAuth,
		component: ConversationPage,
	loader: async ({ params }) => {
		const store = useConversationsStore.getState();
		if (store.entries.length === 0) {
			await store.load();
		}
		store.setActive(params.conversationId);
	},
});

// ---- Helpers ----

const drafts = new Drafts();

function formatTimestamp(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(ts: number): string {
	const d = new Date(ts);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

	if (msgDate.getTime() === today.getTime()) return "Today";
	if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
	return d.toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
}

type DisplayMessage = {
	id: string;
	body: string;
	senderId: number;
	timestamp: number;
	isMine: boolean;
	unsent: boolean;
};

type DateGroup = {
	date: string;
	messages: DisplayMessage[];
};

function groupByDate(messages: DisplayMessage[]): DateGroup[] {
	const groups: DateGroup[] = [];
	let current: DateGroup | null = null;

	for (const msg of messages) {
		const dateLabel = formatDateHeader(msg.timestamp);
		if (!current || current.date !== dateLabel) {
			current = { date: dateLabel, messages: [] };
			groups.push(current);
		}
		current.messages.push(msg);
	}

	return groups;
}

// ---- Component ----

function ConversationPage() {
	const { conversationId } = Route.useParams();
	const { entries, ourProfileId } = useConversationsStore();
	const queryClient = useQueryClient();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const conversation = entries.find(
		(e) => e.data.conversationId === conversationId,
	);

	// Fetch messages from API
	const {
		data: messagesData,
		isLoading: messagesLoading,
		error: messagesError,
	} = useConversationMessages(conversationId);

	// Send message mutation
	const sendMessageMutation = useSendMessage();

	// Local optimistic messages
	const [optimisticMessages, setOptimisticMessages] = useState<
		DisplayMessage[]
	>([]);

	// Draft state - restore from drafts store
	const [draft, setDraft] = useState(() => drafts.open(conversationId));

	// Restore draft when conversation changes
	useEffect(() => {
		setDraft(drafts.open(conversationId));
	}, [conversationId]);

	// Clean up draft when leaving
	useEffect(() => {
		return () => {
			drafts.forget(conversationId);
		};
	}, [conversationId]);

	// Get the other participant's profile ID for sending
	const otherParticipant = conversation?.data.participants?.[0];
	const targetProfileId = otherParticipant?.profileId;

	// Resolve sender ID - our profile from the store
	const meId = ourProfileId;

	// Map API messages to display messages
	const apiMessages: DisplayMessage[] = useMemo(() => {
		if (!messagesData?.messages) return [];
		return (messagesData.messages as ApiResponseMessage[]).map((m) => {
			const body =
				m.type === "Text" &&
				m.body &&
				typeof m.body === "object" &&
				"text" in (m.body as Record<string, unknown>)
					? String((m.body as { text: string }).text)
					: "";
			return {
				id: m.messageId,
				body,
				senderId: m.senderId,
				timestamp: m.timestamp,
				isMine: m.senderId === meId,
				unsent: m.unsent,
			};
		});
	}, [messagesData, meId]);

	// Combine API messages + optimistic messages, dedup by id
	const allMessages = useMemo(() => {
		const seen = new Set<string>();
		const combined: DisplayMessage[] = [];
		for (const msg of apiMessages) {
			if (!seen.has(msg.id)) {
				seen.add(msg.id);
				combined.push(msg);
			}
		}
		for (const msg of optimisticMessages) {
			if (!seen.has(msg.id)) {
				seen.add(msg.id);
				combined.push(msg);
			}
		}
		combined.sort((a, b) => a.timestamp - b.timestamp);
		return combined;
	}, [apiMessages, optimisticMessages]);

	const dateGroups = useMemo(() => groupByDate(allMessages), [allMessages]);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		const el = messagesEndRef.current;
		if (el) {
			el.scrollIntoView({ behavior: "smooth" });
		}
	}, [dateGroups]);

	// Save draft on change
	useEffect(() => {
		drafts.save({ conversationId, text: draft });
	}, [draft, conversationId]);

	// Auto-resize textarea
	useEffect(() => {
		const ta = textareaRef.current;
		if (ta) {
			ta.style.height = "auto";
			ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
		}
	}, [draft]);

	const handleSend = () => {
		const text = draft.trim();
		if (!text || !targetProfileId || !meId) return;

		const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const optimisticMsg: DisplayMessage = {
			id: optimisticId,
			body: text,
			senderId: meId,
			timestamp: Date.now(),
			isMine: true,
			unsent: false,
		};

		// Optimistic insert
		setOptimisticMessages((prev) => [...prev, optimisticMsg]);
		setDraft("");
		drafts.discard(conversationId);

		// Update conversation preview optimistically
		useConversationsStore.getState().updatePreview({
			conversationId,
			preview: text,
			timestamp: Date.now(),
		});

		// Send to server
		sendMessageMutation.mutate(
			{
				toUserId: targetProfileId,
				message: { type: 0, body: text },
			},
			{
				onSuccess: (result) => {
					if (result && "messageId" in result) {
						// Replace optimistic message with server response
						setOptimisticMessages((prev) =>
							prev.filter((m) => m.id !== optimisticId),
						);
						// Invalidate to refetch
						queryClient.invalidateQueries({
							queryKey: ["messages"],
						});
					}
				},
				onError: () => {
					// Remove optimistic message on failure
					setOptimisticMessages((prev) =>
						prev.filter((m) => m.id !== optimisticId),
					);
				},
			},
		);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const isOnline = conversation?.data.onlineUntil !== null;

	return (
		<div className="flex h-full flex-col">
			{/* Conversation Header */}
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link
					to="/chat"
					className="text-muted-foreground hover:text-foreground"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M19 12H5" />
						<path d="M12 19l-7-7 7-7" />
					</svg>
				</Link>
				<Link
					to="/chat/$conversationId"
					params={{ conversationId }}
					className="flex items-center gap-3"
				>
					<div className="relative h-10 w-10">
						<div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
							{conversation?.data.name?.charAt(0) ?? "?"}
						</div>
						{isOnline && (
							<div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
						)}
					</div>
					<div>
						<div className="font-medium">{conversation?.data.name}</div>
						<div className="text-xs text-muted-foreground">
							{isOnline ? "Online" : "Offline"}
						</div>
					</div>
				</Link>
			</div>

			{/* Messages Area */}
			<div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
				{!conversation ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-muted-foreground">Loading conversation...</p>
					</div>
				) : messagesLoading ? (
					<div className="flex h-full items-center justify-center">
						<div className="flex flex-col items-center gap-2">
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
							<p className="text-sm text-muted-foreground">
								Loading messages...
							</p>
						</div>
					</div>
				) : messagesError ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-destructive">Failed to load messages</p>
					</div>
				) : allMessages.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl">
							{conversation.data.name?.charAt(0) ?? "?"}
						</div>
						<p className="text-sm text-muted-foreground">
							Start a conversation with {conversation.data.name}
						</p>
					</div>
				) : (
					<div className="flex flex-col">
						{dateGroups.map((group) => (
							<div key={group.date}>
								{/* Date header */}
								<div className="flex items-center justify-center py-3">
									<span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
										{group.date}
									</span>
								</div>

								{/* Messages in this group */}
								{group.messages.map((msg) => (
									<div
										key={msg.id}
										className={`flex ${msg.isMine ? "justify-end" : "justify-start"} mb-1`}
									>
										<div
											className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
												msg.unsent
													? "bg-muted text-muted-foreground italic"
													: msg.isMine
														? "bg-primary text-primary-foreground rounded-br-md"
														: "bg-muted text-foreground rounded-bl-md"
											}`}
										>
											{msg.unsent ? (
												<span className="text-xs">Message unsent</span>
											) : (
												<p className="whitespace-pre-wrap break-words">
													{msg.body}
												</p>
											)}
											<span
												className={`mt-0.5 block text-[10px] ${
													msg.isMine
														? "text-primary-foreground/70"
														: "text-muted-foreground"
												}`}
											>
												{formatTimestamp(msg.timestamp)}
											</span>
										</div>
									</div>
								))}
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			{/* Message Composer */}
			<div className="border-t border-border p-3">
				<div className="flex items-end gap-2">
					<textarea
						ref={textareaRef}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a message..."
						className="min-h-[44px] max-h-32 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						rows={1}
					/>
					<button
						onClick={handleSend}
						disabled={!draft.trim() || sendMessageMutation.isPending}
						className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{sendMessageMutation.isPending ? (
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="22" y1="2" x2="11" y2="13" />
								<polygon points="22 2 15 22 11 13 2 9 22 2" />
							</svg>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
