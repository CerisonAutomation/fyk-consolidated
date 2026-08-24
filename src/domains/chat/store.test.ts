import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	useConversationsStore,
	type Conversation,
	type ConversationFilterKey,
} from "./store";

function makeConversation(
	overrides: Partial<{ conversationId: string; pinned: boolean; muted: boolean; lastActivityTimestamp: number; unreadCount: number; preview: string | null; name: string; favorite: boolean }> = {},
): Conversation {
	return {
		type: "conversation",
		data: {
			conversationId: overrides.conversationId ?? `conv-${Math.random()}`,
			name: overrides.name ?? "Test User",
			participants: [],
			lastActivityTimestamp: overrides.lastActivityTimestamp ?? Date.now(),
			unreadCount: overrides.unreadCount ?? 0,
			preview: overrides.preview ?? null,
			muted: overrides.muted ?? false,
			pinned: overrides.pinned ?? false,
			favorite: overrides.favorite ?? false,
			rightNow: "",
			onlineUntil: null,
			hasUnreadThrob: false,
		},
	};
}

function resetStore() {
	useConversationsStore.setState({
		entries: [],
		nextPage: null,
		refreshing: false,
		loading: false,
		error: null,
		scrollY: 0,
		activeConversationId: null,
		filters: [],
		ourProfileId: null,
	});
}

describe("conversations store", () => {
	beforeEach(() => {
		resetStore();
	});

	describe("setEntries", () => {
		it("sets entries", () => {
			const entries = [
				makeConversation({ conversationId: "a" }),
				makeConversation({ conversationId: "b" }),
			];
			useConversationsStore.getState().setEntries(entries);
			expect(useConversationsStore.getState().entries).toHaveLength(2);
		});
	});

	describe("setActive / clearActive", () => {
		it("sets active conversation", () => {
			useConversationsStore.getState().setActive("conv-1");
			expect(useConversationsStore.getState().activeConversationId).toBe("conv-1");
		});

		it("clears active conversation if it matches", () => {
			useConversationsStore.setState({ activeConversationId: "conv-1" });
			useConversationsStore.getState().clearActive("conv-1");
			expect(useConversationsStore.getState().activeConversationId).toBeNull();
		});

		it("does not clear active conversation if different id", () => {
			useConversationsStore.setState({ activeConversationId: "conv-1" });
			useConversationsStore.getState().clearActive("conv-2");
			expect(useConversationsStore.getState().activeConversationId).toBe("conv-1");
		});
	});

	describe("remove", () => {
		it("removes a conversation by id", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({ conversationId: "a" }),
					makeConversation({ conversationId: "b" }),
				],
			});
			useConversationsStore.getState().remove("a");
			expect(useConversationsStore.getState().entries).toHaveLength(1);
			expect(useConversationsStore.getState().entries[0].data.conversationId).toBe("b");
		});

		it("does nothing if conversation not found", () => {
			useConversationsStore.setState({
				entries: [makeConversation({ conversationId: "a" })],
			});
			useConversationsStore.getState().remove("nonexistent");
			expect(useConversationsStore.getState().entries).toHaveLength(1);
		});
	});

	describe("sortEntries", () => {
		it("sorts by pinned first, then by timestamp", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({
						conversationId: "old",
						pinned: false,
						lastActivityTimestamp: 100,
					}),
					makeConversation({
						conversationId: "pinned-new",
						pinned: true,
						lastActivityTimestamp: 200,
					}),
					makeConversation({
						conversationId: "new",
						pinned: false,
						lastActivityTimestamp: 300,
					}),
				],
			});

			useConversationsStore.getState().sortEntries();
			const entries = useConversationsStore.getState().entries;
			expect(entries[0].data.conversationId).toBe("pinned-new");
			expect(entries[1].data.conversationId).toBe("new");
			expect(entries[2].data.conversationId).toBe("old");
		});
	});

	describe("updatePreview", () => {
		it("updates preview text and timestamp", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({
						conversationId: "a",
						preview: "old preview",
						lastActivityTimestamp: 100,
					}),
				],
			});

			useConversationsStore.getState().updatePreview({
				conversationId: "a",
				preview: "new preview",
				timestamp: 500,
			});

			const entry = useConversationsStore.getState().entries[0];
			expect(entry.data.preview).toBe("new preview");
			expect(entry.data.lastActivityTimestamp).toBe(500);
		});

		it("does nothing for nonexistent conversation", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({ conversationId: "a", preview: "original" }),
				],
			});

			useConversationsStore.getState().updatePreview({
				conversationId: "nonexistent",
				preview: "updated",
				timestamp: 999,
			});

			expect(useConversationsStore.getState().entries[0].data.preview).toBe("original");
		});
	});

	describe("setPinned", () => {
		it("pins conversations", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({ conversationId: "a", pinned: false }),
					makeConversation({ conversationId: "b", pinned: false }),
				],
			});

			useConversationsStore.getState().setPinned({
				conversationIds: ["a"],
				pinned: true,
			});

			const entries = useConversationsStore.getState().entries;
			expect(entries.find((e) => e.data.conversationId === "a")?.data.pinned).toBe(true);
			expect(entries.find((e) => e.data.conversationId === "b")?.data.pinned).toBe(false);
		});

		it("unpins conversations", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({ conversationId: "a", pinned: true }),
				],
			});

			useConversationsStore.getState().setPinned({
				conversationIds: ["a"],
				pinned: false,
			});

			expect(
				useConversationsStore.getState().entries[0].data.pinned,
			).toBe(false);
		});
	});

	describe("setMuted", () => {
		it("mutes a conversation", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({ conversationId: "a", muted: false }),
				],
			});

			useConversationsStore.getState().setMuted({
				conversationIds: ["a"],
				muted: true,
			});

			expect(
				useConversationsStore.getState().entries[0].data.muted,
			).toBe(true);
		});

		it("unmutes a conversation", () => {
			useConversationsStore.setState({
				entries: [
					makeConversation({ conversationId: "a", muted: true }),
				],
			});

			useConversationsStore.getState().setMuted({
				conversationIds: ["a"],
				muted: false,
			});

			expect(
				useConversationsStore.getState().entries[0].data.muted,
			).toBe(false);
		});
	});

	describe("setFilters", () => {
		it("sets filters", () => {
			useConversationsStore.getState().setFilters(["unread", "favorites"]);
			expect(useConversationsStore.getState().filters).toEqual([
				"unread",
				"favorites",
			]);
		});
	});

	describe("setOurProfileId", () => {
		it("sets our profile id", () => {
			useConversationsStore.getState().setOurProfileId(42);
			expect(useConversationsStore.getState().ourProfileId).toBe(42);
		});
	});

	describe("setLoading / setRefreshing / setError", () => {
		it("updates loading state", () => {
			useConversationsStore.getState().setLoading(true);
			expect(useConversationsStore.getState().loading).toBe(true);
		});

		it("updates refreshing state", () => {
			useConversationsStore.getState().setRefreshing(true);
			expect(useConversationsStore.getState().refreshing).toBe(true);
		});

		it("sets error", () => {
			const error = new Error("test error");
			useConversationsStore.getState().setError(error);
			expect(useConversationsStore.getState().error).toBe(error);
		});
	});
});
