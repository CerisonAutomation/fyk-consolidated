import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useConversationsStore } from '#/domains/chat/store';
import { Drafts } from '#/domains/chat/drafts-store';

export const Route = createFileRoute('/chat/$conversationId/')({
	component: ConversationPage,
});

function ConversationPage() {
	const { conversationId } = Route.useParams();
	const { entries, setActive, clearActive } = useConversationsStore();
	const [draft, setDraft] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const conversation = entries.find(
		(e) => e.data.conversationId === conversationId,
	);

	useEffect(() => {
		setActive(conversationId);
		return () => clearActive(conversationId);
	}, [conversationId, setActive, clearActive]);

	const handleSend = () => {
		if (!draft.trim()) return;
		// TODO: Wire to actual message sending
		console.log('Send message:', draft);
		setDraft('');
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="flex h-full flex-col">
			{/* Conversation Header */}
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<a href="/chat" className="text-muted-foreground hover:text-foreground">
					←
				</a>
				<div className="flex items-center gap-3">
					<div className="relative h-10 w-10">
						<div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
							{conversation?.data.name?.charAt(0) ?? '?'}
						</div>
						{conversation?.data.onlineUntil !== null && (
							<div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
						)}
					</div>
					<div>
						<div className="font-medium">{conversation?.data.name}</div>
					</div>
				</div>
			</div>

			{/* Messages Area */}
			<div className="flex-1 overflow-y-auto p-4">
				{!conversation ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-muted-foreground">Loading conversation...</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<div className="text-center text-sm text-muted-foreground">
							Select a conversation to start chatting
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Message Composer */}
			<div className="border-t border-border p-3">
				<div className="flex items-end gap-2">
					<textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a message..."
						className="min-h-[44px] max-h-32 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						rows={1}
					/>
					<button
						onClick={handleSend}
						disabled={!draft.trim()}
						className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						↑
					</button>
				</div>
			</div>
		</div>
	);
}
