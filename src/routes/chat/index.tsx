import { createFileRoute } from "@tanstack/react-router";
import { MessagesClient } from "#/components/chat/messages-client";

/**
 * `/chat` — the inbox.
 *
 * This file was a hand-written list driven by the inherited REST hooks
 * (`POST /v4/inbox`, numeric participant ids, a `full_conversation_v1` envelope
 * no route here produced), so it rendered an empty list over a failed query.
 * `#/components/chat/messages-client` is the design's own inbox and already
 * speaks `/api/conversations` — one list, one query key (`["conversations"]`),
 * shared with the thread view and the unread badges.
 */
export const Route = createFileRoute("/chat/")({
	component: MessagesClient,
});
