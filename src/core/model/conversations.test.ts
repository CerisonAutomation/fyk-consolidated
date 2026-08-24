import { describe, it, expect } from "vitest";
import { fullConversationSchema } from "./conversations";

const VALID_MEDIA_HASH = "a".repeat(40);

describe("fullConversationSchema", () => {
	function makeConversation(overrides?: Record<string, unknown>) {
		return {
			type: "full_conversation_v1" as const,
			data: {
				conversationId: "conv-123",
				name: "Test User",
				participants: [
					{
						profileId: 100,
						primaryMediaHash: VALID_MEDIA_HASH,
						lastOnline: 1700000000000,
						onlineUntil: 1700000000000,
						distanceMetres: 1500,
						position: 1,
						isInAList: false,
						hasDatingPotential: true,
					},
				],
				lastActivityTimestamp: 1700000000000,
				unreadCount: 3,
				preview: {
					type: "Text",
					text: "Hey, how are you?",
					albumId: null,
					imageHash: null,
					lat: null,
					lon: null,
					duration: null,
					photoContentReply: null,
				},
				muted: false,
				pinned: true,
				favorite: true,
				rightNow: "NOT_ACTIVE",
				onlineUntil: 1700000000000,
				hasUnreadThrob: true,
				...overrides,
			},
		};
	}

	it("parses a valid full conversation", () => {
		const result = fullConversationSchema.safeParse(makeConversation());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("full_conversation_v1");
			expect(result.data.data.conversationId).toBe("conv-123");
			expect(result.data.data.name).toBe("Test User");
			expect(result.data.data.participants).toHaveLength(1);
			expect(result.data.data.unreadCount).toBe(3);
			expect(result.data.data.pinned).toBe(true);
			expect(result.data.data.favorite).toBe(true);
		}
	});

	it("parses conversation with null preview", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({ preview: null }),
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.data.preview).toBeNull();
		}
	});

	it("parses conversation with null primaryMediaHash", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({
				participants: [
					{
						profileId: 100,
						primaryMediaHash: null,
						lastOnline: 1700000000000,
						onlineUntil: 1700000000000,
						distanceMetres: 1500,
						position: 1,
						isInAList: false,
						hasDatingPotential: true,
					},
				],
			}),
		);
		expect(result.success).toBe(true);
	});

	it("parses conversation with null distanceMetres", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({
				participants: [
					{
						profileId: 100,
						primaryMediaHash: VALID_MEDIA_HASH,
						lastOnline: 1700000000000,
						onlineUntil: 1700000000000,
						distanceMetres: null,
						position: 1,
						isInAList: false,
						hasDatingPotential: true,
					},
				],
			}),
		);
		expect(result.success).toBe(true);
	});

	it("parses conversation with null position", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({
				participants: [
					{
						profileId: 100,
						primaryMediaHash: VALID_MEDIA_HASH,
						lastOnline: 1700000000000,
						onlineUntil: 1700000000000,
						distanceMetres: 1500,
						position: null,
						isInAList: false,
						hasDatingPotential: true,
					},
				],
			}),
		);
		expect(result.success).toBe(true);
	});

	it("parses conversation with muted and zero unread", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({ muted: true, unreadCount: 0, hasUnreadThrob: false }),
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.data.muted).toBe(true);
			expect(result.data.data.unreadCount).toBe(0);
		}
	});

	it("rejects conversation with wrong type", () => {
		const result = fullConversationSchema.safeParse({
			...makeConversation(),
			type: "wrong_type",
		});
		expect(result.success).toBe(false);
	});

	it("rejects conversation with empty participants", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({ participants: [] }),
		);
		expect(result.success).toBe(false);
	});

	it("rejects conversation with two participants", () => {
		const p = makeConversation().data.participants[0];
		const result = fullConversationSchema.safeParse(
			makeConversation({ participants: [p, p] }),
		);
		expect(result.success).toBe(false);
	});

	it("rejects conversation missing conversationId", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({ conversationId: undefined }),
		);
		expect(result.success).toBe(false);
	});

	it("rejects conversation with non-numeric unreadCount", () => {
		const result = fullConversationSchema.safeParse(
			makeConversation({ unreadCount: "not a number" }),
		);
		expect(result.success).toBe(false);
	});
});
