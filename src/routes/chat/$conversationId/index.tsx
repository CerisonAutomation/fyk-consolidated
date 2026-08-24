import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, Send, Paperclip, Smile, MoreVertical, Pin, VolumeX } from "lucide-react";
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

const DEMO_MESSAGES: Message[] = [
	{
		id: "1",
		text: "Hey! What's up?",
		sentByMe: false,
		timestamp: Date.now() - 3600000,
		read: true,
		type: "text",
	},
	{
		id: "2",
		text: "Not much, just browsing. You?",
		sentByMe: true,
		timestamp: Date.now() - 3500000,
		read: true,
		type: "text",
	},
	{
		id: "3",
		text: "Same here! This app is pretty cool though",
		sentByMe: false,
		timestamp: Date.now() - 3400000,
		read: true,
		type: "text",
	},
	{
		id: "4",
		text: "Yeah, I like the design a lot. The gold accents are 🔥",
		sentByMe: true,
		timestamp: Date.now() - 3300000,
		read: true,
		type: "text",
	},
	{
		id: "5",
		text: "For real! Wanna grab coffee sometime?",
		sentByMe: false,
		timestamp: Date.now() - 1800000,
		read: true,
		type: "text",
	},
];

function ConversationPage() {
	const { conversationId } = Route.useParams();
	const { entries, setActive } = useConversationsStore();
	const [draft, setDraft] = useState("");
	const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
	const [sending, setSending] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const conversation = entries.find(
		(e) => e.data.conversationId === conversationId,
	);

	useEffect(() => {
		setActive(conversationId);
		return () => setActive(null);
	}, [conversationId, setActive]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSend = useCallback(() => {
		if (!draft.trim() || sending) return;
		const text = draft.trim();
		setDraft("");
		setSending(true);

		const newMessage: Message = {
			id: `msg-${Date.now()}`,
			text,
			sentByMe: true,
			timestamp: Date.now(),
			read: false,
			type: "text",
		};

		setMessages((prev) => [...prev, newMessage]);

		// Simulate delivery
		setTimeout(() => {
			setSending(false);
			setMessages((prev) =>
				prev.map((m) => (m.id === newMessage.id ? { ...m, read: true } : m)),
			);
		}, 800);

		// Simulate reply after delay
		setTimeout(() => {
			const replies = [
				"That's interesting!",
				"Haha nice 😄",
				"Cool, tell me more",
				"I agree!",
				"👍",
				"What do you think about that?",
			];
			const reply: Message = {
				id: `msg-${Date.now() + 1}`,
				text: replies[Math.floor(Math.random() * replies.length)],
				sentByMe: false,
				timestamp: Date.now(),
				read: true,
				type: "text",
			};
			setMessages((prev) => [...prev, reply]);
		}, 2000 + Math.random() * 3000);
	}, [draft, sending]);

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

	const isOnline = conversation?.data.onlineUntil !== null;

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
								background: "linear-gradient(135deg, rgba(234,179,8,0.2), rgba(168,85,247,0.2))",
								color: "#EAAB08",
							}}
						>
							{conversation?.data.name?.charAt(0) ?? "?"}
						</div>
						{isOnline && (
							<div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#0a0014]" />
						)}
					</div>
					<div>
						<p className="text-sm font-medium text-white">
							{conversation?.data.name ?? "Unknown"}
						</p>
						<p className="text-[11px] text-white/40">
							{isOnline ? "Online" : "Last seen recently"}
						</p>
					</div>
				</div>
				<div className="ml-auto flex items-center gap-1">
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white/60"
					>
						<Pin className="h-4 w-4" />
					</button>
					<button
						type="button"
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
			<div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "thin" }}>
				{!conversation ? (
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
												msg.sentByMe
													? "rounded-br-md"
													: "rounded-bl-md"
											}`}
											style={{
												background: msg.sentByMe
													? "linear-gradient(135deg, rgba(234,179,8,0.25), rgba(234,179,8,0.15))"
													: "rgba(255,255,255,0.06)",
												color: msg.sentByMe ? "#f5d76e" : "rgba(255,255,255,0.85)",
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
							onChange={(e) => setDraft(e.target.value)}
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
						disabled={!draft.trim() || sending}
						className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
						style={{
							background:
								draft.trim() && !sending
									? "linear-gradient(135deg, #EAAB08, #D4AF37)"
									: "rgba(255,255,255,0.05)",
							color: draft.trim() && !sending ? "#000" : "rgba(255,255,255,0.3)",
						}}
					>
						{sending ? (
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
