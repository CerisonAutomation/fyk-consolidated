import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChatView } from "@/components/chat/chat-view";
import { api } from "@/lib/client";

export const Route = createFileRoute("/chat/$conversationId/")({
	component: ConversationPage,
	// `/chat/$conversationId?with=<profileId>` is how a profile sheet opens a
	// thread whose id it does not know yet.
	validateSearch: (search: Record<string, unknown>): { with?: string } => ({
		...(typeof search.with === "string" && search.with ? { with: search.with } : {}),
	}),
});

/**
 * `/chat/$conversationId` — one thread, on the design's own `ChatView`.
 *
 * Two shapes of param are accepted and the difference is resolved once, here:
 *   - a conversation uuid → render it (the API refuses a thread the caller is
 *     not a member of, so no client-side check is trusted);
 *   - the literal `new` with `?with=<profileId>` → ask `POST /api/conversations`
 *     for the pair's thread and replace the URL with the real id. That endpoint is
 *     idempotent per pair, so a second "Message" click reuses the conversation
 *     instead of minting a duplicate — this replaces a synthetic `min:max`
 *     composite id that no server could resolve.
 */
function ConversationPage() {
	const { conversationId } = Route.useParams();
	const { with: peerId } = Route.useSearch();
	const navigate = useNavigate();
	const [resolved, setResolved] = useState<string | null>(
		conversationId === "new" ? null : conversationId,
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (conversationId !== "new") {
			setResolved(conversationId);
			return;
		}
		if (!peerId) {
			setError("Nothing to open: this link needs a profile to message.");
			return;
		}
		let cancelled = false;
		api<{ conversationId: string }>("/api/conversations", {
			method: "POST",
			body: { targetId: peerId },
		})
			.then((result) => {
				if (cancelled) return;
				setResolved(result.conversationId);
				void navigate({
					to: "/chat/$conversationId",
					params: { conversationId: result.conversationId },
					replace: true,
				});
			})
			.catch((cause: Error) => {
				if (!cancelled) setError(cause.message || "Could not open this conversation");
			});
		return () => {
			cancelled = true;
		};
	}, [conversationId, peerId, navigate]);

	if (error) {
		return (
			<div className="mx-auto max-w-md p-6">
				<p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
					{error}
				</p>
				<button
					type="button"
					onClick={() => void navigate({ to: "/chat" })}
					className="mt-3 text-sm text-gold hover:text-gold-soft"
				>
					Back to messages
				</button>
			</div>
		);
	}

	if (!resolved) {
		return (
			<div className="space-y-2 p-4" aria-busy="true">
				<div className="skeleton h-12 w-2/3 rounded-xl" />
				<div className="skeleton h-12 w-1/2 rounded-xl" />
			</div>
		);
	}

	return <ChatView conversationId={resolved} onBack={() => void navigate({ to: "/chat" })} />;
}
