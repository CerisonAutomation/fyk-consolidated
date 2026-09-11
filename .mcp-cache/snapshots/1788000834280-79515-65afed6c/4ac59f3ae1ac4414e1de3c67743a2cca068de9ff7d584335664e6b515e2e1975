import { describe, expect, it } from "vitest";

import { demoRoute } from "./router";

describe("Open Grind MVP compatibility adapter", () => {
	it("returns complete profile details", () => {
		const response = demoRoute({
			path: "/v7/profiles/100001",
			method: "GET",
			body: undefined,
		});
		const body = response.body as { profiles: Record<string, unknown>[] };

		expect(response.status).toBe(200);
		expect(body.profiles[0]).toMatchObject({
			profileId: 100001,
			displayName: expect.any(String),
			medias: expect.any(Array),
		});
	});

	it("persists favorite, hide, and block mutations for the session", () => {
		for (const request of [
			{ path: "/v3/me/favorites/100777", method: "POST" },
			{ path: "/v1/me/hides/100777", method: "POST" },
			{ path: "/v3/me/blocks/100777", method: "POST" },
		]) {
			demoRoute({ ...request, body: undefined });
		}

		const profile = demoRoute({
			path: "/v7/profiles/100777",
			method: "GET",
			body: undefined,
		}).body as { profiles: Array<{ isFavorite: boolean }> };
		const hides = demoRoute({
			path: "/v1/hides",
			method: "GET",
			body: undefined,
		}).body as { hides: Array<{ profileId: number }> };
		const blocks = demoRoute({
			path: "/v3.1/me/blocks",
			method: "GET",
			body: undefined,
		}).body as { blocking: Array<{ profileId: number }> };

		expect(profile.profiles[0]?.isFavorite).toBe(true);
		expect(hides.hides).toContainEqual({ profileId: 100777 });
		expect(blocks.blocking).toContainEqual(
			expect.objectContaining({ profileId: 100777 }),
		);
	});

	it("adds sent messages to the matching conversation", () => {
		const sent = demoRoute({
			path: "/v4/chat/message/send",
			method: "POST",
			body: {
				type: 1,
				target: { type: "Direct", targetId: 100001 },
				body: "MVP message",
			},
		}).body as { conversationId: string; messageId: string };
		const conversation = demoRoute({
			path: `/v5/chat/conversation/${sent.conversationId}/message?profile=true`,
			method: "GET",
			body: undefined,
		}).body as { messages: Array<{ messageId: string }> };

		expect(conversation.messages).toContainEqual(
			expect.objectContaining({ messageId: sent.messageId }),
		);
	});
});
