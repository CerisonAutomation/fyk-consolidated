import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ChevronLeft,
	MoreVertical,
	Paperclip,
	Pin,
	Send,
	Smile,
	VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	useMuteConversation,
	usePinConversation,
} from "#/core/api/hooks/use-conversations";
import {
	useConversationMessages,
	useSendMessage,
} from "#/core/api/hooks/use-messages";
import { Drafts } from "#/domains/chat/drafts-store";
import { useConversationsStore } from "#/domains/chat/store";

export const Route = createFileRoute("/chat/$conversationId/")({
	component: ConversationPage,
});

interface Message {
	id: string;
	text: string;
	sentByMe: boolean;
	timestamp: number;
	read: boolean;
	type: "text" | "image" | "tap";
}

const drafts = new Drafts();

function ConversationPage() {
	const { conversationId } = Route.useParams();
	const { entries, setActive } = useConversationsStore();
	const [draft, setDraft] = useState(() => drafts.open(conversationId));
	const draftRef = useRef(draft);
	const [messages, setMessages] = useState<Message[]>([]);
	const messagesQuery = useConversationMessages(conversationId);
	const sendMessage = useSendMessage();
	const pinConversation = usePinConversation();
	const muteConversation = useMuteConversation();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const conversation = entries.find(
		(e) => e.data.conversationId === conversationId,
	);

	useEffect(() => {
		setActive(conversationId);
		return () => {
			drafts.save({ conversationId, text: draftRef.current });
			setActive(null);
		};
	}, [conversationId, setActive]);

	useEffect(() => {
		if (!messagesQuery.data) return;
		const otherProfileId = messagesQuery.data.profile.profileId;
		setMessages(
			messagesQuery.data.messages
				.flatMap((message) => {
					const parsed = toMessage(message, otherProfileId);
					return parsed ? [parsed] : [];
				})
				.sort((a, b) => a.timestamp - b.timestamp),
		);
	}, [messagesQuery.data]);

	useEffect(() => {
		if (messages.length === 0) return;
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

	const handleSend = useCallback(() => {
		if (!draft.trim() || sendMessage.isPending) return;
		const text = draft.trim();
		setDraft("");
		draftRef.current = "";
		drafts.discard(conversationId);
		const participantId =
			conversation?.data.participants[0]?.profileId ??
			Number(conversationId.split(":").at(-1));
		sendMessage.mutate(
			{
				toUserId: participantId,
				message: { type: 1, body: text },
			},
			{
				onSuccess: (message) => {
					const parsed = toMessage(message, participantId);
					if (parsed) setMessages((current) => [...current, parsed]);
				},
				onError: () => {
					draftRef.current = text;
					setDraft(text);
				},
			},
		);
	}, [conversation, conversationId, draft, sendMessage]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const formatTime = (ts: number) => {
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	};

	const isOnline =
		(conversation?.data.onlineUntil ??
			messagesQuery.data?.profile.onlineUntil) !== null;
	const displayName =
		conversation?.data.name ?? messagesQuery.data?.profile.name ?? "Unknown";

	return (
		<div className="flex h-full flex-col bg-[#0a0014]">
			{/* Header */}
			<div
				className="flex items-center gap-3 border-b px-4 py-3"
				style={{ borderColor: "rgba(255,255,255,0.06)" }}
			>
				<Link
					to="/chat"
					className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/50 transition hover:bg-white/10"
				>
					<ChevronLeft className="h-5 w-5" />
				</Link>
				<div className="flex items-center gap-3">
					<div className="relative h-10 w-10">
						<div
							className="flex h-full w-full items-center justify-center rounded-full text-sm font-bold"
							style={{
								background:
									"linear-gradient(135deg, rgba(234,179,8,0.2), rgba(168,85,247,0.2))",
								color: "#EAAB08",
							}}
						>
							{displayName.charAt(0) || "?"}
						</div>
						{isOnline && (
							<div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#0a0014]" />
						)}
					</div>
					<div>
						<p className="text-sm font-medium text-white">{displayName}</p>
						<p className="text-[11px] text-white/40">
							{isOnline ? "Online" : "Last seen recently"}
						</p>
					</div>
				</div>
				<div className="ml-auto flex items-center gap-1">
					<button
						type="button"
						onClick={() =>
							pinConversation.mutate({
								conversationId,
								pinned: !(conversation?.data.pinned ?? false),
							})
						}
						aria-pressed={conversation?.data.pinned ?? false}
						className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white/60"
					>
						<Pin className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() =>
							muteConversation.mutate({
								conversationId,
								muted: !(conversation?.data.muted ?? false),
							})
						}
						aria-pressed={conversation?.data.muted ?? false}
						className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white/60"
					>
						<VolumeX className="h-4 w-4" />
					</button>
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white/60"
					>
						<MoreVertical className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Messages */}
			<div
				className="flex-1 overflow-y-auto px-4 py-4"
				style={{ scrollbarWidth: "thin" }}
			>
				{messagesQuery.isLoading ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-sm text-white/40">Loading conversation...</p>
					</div>
				) : messages.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2">
						<div className="text-4xl">👋</div>
						<p className="text-sm text-white/40">Say hello!</p>
					</div>
				) : (
					<div className="flex flex-col gap-1.5">
						{messages.map((msg, idx) => {
							const showTime =
								idx === 0 ||
								msg.timestamp - messages[idx - 1]?.timestamp > 300000;
							return (
								<div key={msg.id}>
									{showTime && (
										<div className="my-2 text-center text-[10px] text-white/20">
											{formatTime(msg.timestamp)}
										</div>
									)}
									<div
										className={`flex ${msg.sentByMe ? "justify-end" : "justify-start"}`}
									>
										<div
											className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
												msg.sentByMe ? "rounded-br-md" : "rounded-bl-md"
											}`}
											style={{
												background: msg.sentByMe
													? "linear-gradient(135deg, rgba(234,179,8,0.25), rgba(234,179,8,0.15))"
													: "rgba(255,255,255,0.06)",
												color: msg.sentByMe
													? "#f5d76e"
													: "rgba(255,255,255,0.85)",
											}}
										>
											<p>{msg.text}</p>
											{msg.sentByMe && (
												<div className="mt-0.5 flex justify-end">
													<span
														className={`text-[9px] ${
															msg.read ? "text-amber-400/60" : "text-white/20"
														}`}
													>
														{msg.read ? "✓✓" : "✓"}
													</span>
												</div>
											)}
										</div>
									</div>
								</div>
							);
						})}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			{/* Composer */}
			<div
				className="border-t px-3 py-3"
				style={{ borderColor: "rgba(255,255,255,0.06)" }}
			>
				<div className="flex items-end gap-2">
					<button
						type="button"
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/5 hover:text-white/50"
					>
						<Paperclip className="h-5 w-5" />
					</button>
					<div className="relative flex-1">
						<textarea
							ref={inputRef}
							value={draft}
							onChange={(e) => {
								draftRef.current = e.target.value;
								setDraft(e.target.value);
								drafts.autosave({ conversationId, text: e.target.value });
							}}
							onKeyDown={handleKeyDown}
							placeholder="Type a message..."
							rows={1}
							className="min-h-[44px] max-h-32 w-full resize-none rounded-xl bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
							style={{ border: "1px solid rgba(255,255,255,0.08)" }}
						/>
						<button
							type="button"
							className="absolute right-2 bottom-2.5 text-white/25 transition hover:text-white/40"
						>
							<Smile className="h-5 w-5" />
						</button>
					</div>
					<button
						type="button"
						onClick={handleSend}
						disabled={!draft.trim() || sendMessage.isPending}
						className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
						style={{
							background:
								draft.trim() && !sendMessage.isPending
									? "linear-gradient(135deg, #EAAB08, #D4AF37)"
									: "rgba(255,255,255,0.05)",
							color:
								draft.trim() && !sendMessage.isPending
									? "#000"
									: "rgba(255,255,255,0.3)",
						}}
					>
						{sendMessage.isPending ? (
							<span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
						) : (
							<Send className="h-5 w-5" />
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

function toMessage(
	value: Record<string, unknown>,
	otherProfileId: number,
): Message | null {
	if (
		typeof value.messageId !== "string" ||
		typeof value.timestamp !== "number"
	) {
		return null;
	}
	const body =
		value.body && typeof value.body === "object"
			? (value.body as Record<string, unknown>)
			: null;
	if (!body || typeof body.text !== "string") return null;
	return {
		id: value.messageId,
		text: body.text,
		sentByMe: value.senderId !== otherProfileId,
		timestamp: value.timestamp,
		read: true,
		type: "text",
	};
}
