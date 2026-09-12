import { describe, expect, it } from "vitest";
import { sendMessageAck } from "./chat";

/**
 * The response a sender gets back is a boundary, not a convenience: whatever the
 * row happens to contain is what the browser receives. These assertions exist so
 * that nobody "helpfully" switches the handler back to returning `insert.data`.
 */
describe("sendMessageAck", () => {
	const rawRow = {
		id: "b2f0dc9d-6d1f-4f6e-8a1a-6d4a4f3a1c11",
		conversation_id: "7c0a1f4e-2b3c-4d5e-9f60-718293a4b5c6",
		sender_id: "0d9e8f7a-6b5c-4d3e-2f10-1a2b3c4d5e6f",
		type: "text",
		body: "coffee at 4?",
		storage_path: "chat-media-private/0d9e/img_1234.heic",
		album_share_id: null,
		reply_to_id: null,
		expires_at: null,
		unsent_at: null,
		edited_at: null,
		pinned_at: null,
		pinned_by: null,
		created_at: "2026-09-12T09:41:07.000Z",
	};

	it("returns only what the client needs to settle its own optimistic row", () => {
		expect(sendMessageAck(rawRow)).toEqual({
			id: rawRow.id,
			createdAt: rawRow.created_at,
		});
	});

	it("never leaks storage paths, internal ids or snake_case column names", () => {
		const serialized = JSON.stringify(sendMessageAck(rawRow));
		expect(serialized).not.toMatch("storage_path");
		expect(serialized).not.toMatch("sender_id");
		expect(serialized).not.toMatch("album_share");
		expect(serialized).not.toMatch("chat-media-private");
		expect(serialized).not.toMatch(/"[a-z]+_[a-z_]+":/);
	});
});
