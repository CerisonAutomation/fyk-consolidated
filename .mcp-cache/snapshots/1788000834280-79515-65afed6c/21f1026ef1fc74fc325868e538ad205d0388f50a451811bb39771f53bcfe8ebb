import { describe, it, expect } from "vitest";
import {
	messageSchema,
	textMessageSchema,
	imageMessageSchema,
	videoMessageSchema,
	gaymojiMessageSchema,
	giphyMessageSchema,
	locationMessageSchema,
	audioMessageSchema,
	retractMessageSchema,
	expiringImageMessageSchema,
	outboundMessageSchema,
	draftFromMessage,
	type TextMessage,
} from "./messages";

describe("textMessageSchema", () => {
	it("parses a valid text message", () => {
		const result = textMessageSchema.safeParse({
			type: "Text",
			body: { text: "Hello world" },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Text");
			expect(result.data.body.text).toBe("Hello world");
		}
	});

	it("rejects text message with wrong body type", () => {
		const result = textMessageSchema.safeParse({
			type: "Text",
			body: { text: 123 },
		});
		expect(result.success).toBe(false);
	});
});

describe("imageMessageSchema", () => {
	it("parses a valid image message", () => {
		const result = imageMessageSchema.safeParse({
			type: "Image",
			body: {
				mediaId: 42,
				width: 800,
				height: 600,
				url: "https://example.com/image.jpg",
				imageHash: "a".repeat(40),
				takenOnGrindr: true,
				createdAt: 1700000000000,
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Image");
			expect(result.data.body.mediaId).toBe(42);
			expect(result.data.body.takenOnGrindr).toBe(true);
		}
	});

	it("parses image with null dimensions", () => {
		const result = imageMessageSchema.safeParse({
			type: "Image",
			body: {
				mediaId: 42,
				width: null,
				height: null,
				url: "https://example.com/image.jpg",
				imageHash: "a".repeat(40),
				takenOnGrindr: false,
				createdAt: null,
			},
		});
		expect(result.success).toBe(true);
	});
});

describe("videoMessageSchema", () => {
	it("parses a valid video message", () => {
		const result = videoMessageSchema.safeParse({
			type: "Video",
			body: {
				mediaId: 99,
				url: "https://example.com/video.mp4",
				contentType: "video/mp4",
				length: 15000,
				maxViews: null,
				looping: false,
				viewsRemaining: 10,
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Video");
			expect(result.data.body.length).toBe(15000);
		}
	});
});

describe("gaymojiMessageSchema", () => {
	it("parses a valid gaymoji message", () => {
		const result = gaymojiMessageSchema.safeParse({
			type: "Gaymoji",
			body: { imageHash: "abc123" },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Gaymoji");
			expect(result.data.body.imageHash).toBe("abc123");
		}
	});
});

describe("giphyMessageSchema", () => {
	it("parses a valid giphy message", () => {
		const result = giphyMessageSchema.safeParse({
			type: "Giphy",
			body: {
				id: "giphy-123",
				urlPath: "https://media.giphy.com/media/123/giphy.gif",
				stillPath: "https://media.giphy.com/media/123/giphy_s.gif",
				previewPath: "preview",
				width: 480,
				height: 320,
				imageHash: "giphyhash",
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Giphy");
			expect(result.data.body.id).toBe("giphy-123");
		}
	});
});

describe("locationMessageSchema", () => {
	it("parses a valid location message", () => {
		const result = locationMessageSchema.safeParse({
			type: "Location",
			body: { lat: 40.7128, lon: -74.006 },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Location");
			expect(result.data.body.lat).toBe(40.7128);
			expect(result.data.body.lon).toBe(-74.006);
		}
	});
});

describe("audioMessageSchema", () => {
	it("parses a valid audio message", () => {
		const result = audioMessageSchema.safeParse({
			type: "Audio",
			body: {
				mediaId: 55,
				mediaHash: null,
				url: "https://example.com/audio.m4a",
				contentType: "audio/m4a",
				length: 8000,
				expiresAt: null,
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Audio");
			expect(result.data.body.mediaId).toBe(55);
		}
	});
});

describe("retractMessageSchema", () => {
	it("parses a valid retract message", () => {
		const result = retractMessageSchema.safeParse({
			type: "Retract",
			body: { targetMessageId: "msg-123" },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("Retract");
			expect(result.data.body.targetMessageId).toBe("msg-123");
		}
	});
});

describe("expiringImageMessageSchema", () => {
	it("parses a valid expiring image message", () => {
		const result = expiringImageMessageSchema.safeParse({
			type: "ExpiringImage",
			body: {
				mediaId: 77,
				width: 640,
				height: 480,
				url: "https://example.com/expiring.jpg",
				viewsRemaining: 5,
				duration: 30,
				expiresAt: 1700000000000,
				viewed: false,
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("ExpiringImage");
			expect(result.data.body.viewsRemaining).toBe(5);
		}
	});
});

describe("messageSchema (discriminated union)", () => {
	it("parses each known message type", () => {
		const types = [
			{ type: "Text", body: { text: "hi" } },
			{
				type: "Image",
				body: {
					mediaId: 1,
					width: null,
					height: null,
					url: "https://example.com/i.jpg",
					imageHash: "a".repeat(40),
					takenOnGrindr: false,
					createdAt: null,
				},
			},
			{ type: "Gaymoji", body: { imageHash: "abc" } },
			{ type: "Retract", body: { targetMessageId: "x" } },
			{ type: "Location", body: { lat: 0, lon: 0 } },
		];

		for (const msg of types) {
			const result = messageSchema.safeParse(msg);
			expect(result.success, `Failed to parse type: ${msg.type}`).toBe(true);
		}
	});

	it("rejects unknown message types", () => {
		const result = messageSchema.safeParse({
			type: "FutureMessageType",
			body: {},
		});
		expect(result.success).toBe(false);
	});
});

describe("outboundMessageSchema", () => {
	it("parses a valid outbound text message", () => {
		const result = outboundMessageSchema.safeParse({
			type: "Text",
			body: { text: "Hello!" },
		});
		expect(result.success).toBe(true);
	});

	it("parses a valid outbound image message", () => {
		const result = outboundMessageSchema.safeParse({
			type: "Image",
			body: { mediaId: 42 },
		});
		expect(result.success).toBe(true);
	});

	it("parses a valid outbound location message", () => {
		const result = outboundMessageSchema.safeParse({
			type: "Location",
			body: { lat: 40.7, lon: -74.0 },
		});
		expect(result.success).toBe(true);
	});

	it("parses a valid outbound video message", () => {
		const result = outboundMessageSchema.safeParse({
			type: "Video",
			body: { mediaId: 10, looping: false, maxViews: 5 },
		});
		expect(result.success).toBe(true);
	});
});

describe("draftFromMessage", () => {
	it("creates a draft from a text message", () => {
		const msg: TextMessage = {
			type: "Text",
			body: { text: "Hello!" },
		};
		const draft = draftFromMessage(msg);
		expect(draft.outbound).toEqual(msg);
		expect(draft.optimistic).toEqual(msg);
	});

	it("creates a draft from a location message", () => {
		const msg = {
			type: "Location" as const,
			body: { lat: 40.7, lon: -74.0 },
		};
		const draft = draftFromMessage(msg);
		expect(draft.outbound.type).toBe("Location");
		expect(draft.optimistic.type).toBe("Location");
	});
});
