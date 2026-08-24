import { create } from 'zustand';

export interface ConversationParticipant {
	profileId: number;
	primaryMediaHash: string | null;
	lastOnline: number;
	onlineUntil: number | null;
	distanceMetres: number | null;
	position: string | null;
	isInAList: boolean;
	hasDatingPotential: boolean;
}

export interface ConversationData {
	conversationId: string;
	name: string;
	participants: ConversationParticipant[];
	lastActivityTimestamp: number;
	unreadCount: number;
	preview: string | null;
	muted: boolean;
	pinned: boolean;
	favorite: boolean;
	rightNow: string;
	onlineUntil: number | null;
	hasUnreadThrob: boolean;
}

export interface Conversation {
	type: string;
	data: ConversationData;
}

export type ConversationFilterKey = 'all' | 'unread' | 'favorites';

interface ConversationsState {
	entries: Conversation[];
	nextPage: number | null;
	refreshing: boolean;
	loading: boolean;
	error: Error | null;
	scrollY: number;
	activeConversationId: string | null;
	filters: ConversationFilterKey[];
	ourProfileId: number | null;

	load: () => Promise<void>;
	setEntries: (entries: Conversation[]) => void;
	setNextPage: (page: number | null) => void;
	setLoading: (loading: boolean) => void;
	setRefreshing: (refreshing: boolean) => void;
	setError: (error: Error | null) => void;
	setActive: (conversationId: string | null) => void;
	clearActive: (conversationId: string) => void;
	setFilters: (filters: ConversationFilterKey[]) => void;
	setOurProfileId: (id: number) => void;
	remove: (conversationId: string) => void;
	sortEntries: () => void;
	updatePreview: (args: {
		conversationId: string;
		preview: string;
		timestamp: number;
	}) => void;
	setPinned: (args: { conversationIds: string[]; pinned: boolean }) => void;
	setMuted: (args: { conversationIds: string[]; muted: boolean }) => void;
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
	entries: [],
	nextPage: null,
	refreshing: false,
	loading: true,
	error: null,
	scrollY: 0,
	activeConversationId: null,
	filters: [],
	ourProfileId: null,

	setEntries: (entries) => set({ entries }),
	setNextPage: (page) => set({ nextPage: page }),
	setLoading: (loading) => set({ loading }),
	setRefreshing: (refreshing) => set({ refreshing }),
	setError: (error) => set({ error }),
	setActive: (conversationId) => set({ activeConversationId: conversationId }),
	clearActive: (conversationId) => {
		const { activeConversationId } = get();
		if (activeConversationId === conversationId) {
			set({ activeConversationId: null });
		}
	},
	setFilters: (filters) => set({ filters }),
	setOurProfileId: (id) => set({ ourProfileId: id }),

	async load() {
		set({ loading: true, error: null });
		try {
			const { getConversations } = await import("#/core/api/supabase/index");
			const { demoRoute } = await import("#/domains/demo/router");

			const result = await getConversations(1);

			// If Supabase has data, use it
			if (result.entries.length > 0) {
				const entries: Conversation[] = result.entries.map(
					(e: { type: string; data: Record<string, unknown> }) => ({
						type: e.type,
						data: {
							...e.data,
							lastActivityTimestamp: new Date(
								e.data.lastActivityTimestamp as string,
							).getTime(),
							onlineUntil:
								typeof e.data.onlineUntil === "string"
									? new Date(e.data.onlineUntil).getTime()
									: (e.data.onlineUntil as number | null),
							participants: (
								e.data.participants as Array<Record<string, unknown>>
							).map((p) => ({
								...p,
								lastOnline: new Date(p.lastOnline as string).getTime(),
								onlineUntil:
									typeof p.onlineUntil === "string"
										? new Date(p.onlineUntil as string).getTime()
										: (p.onlineUntil as number | null),
							})),
						},
					}),
				);
				set({ entries, loading: false });
				return;
			}

			// Fallback to demo data
			const resp = demoRoute({
				path: "/v4/inbox?page=1",
				method: "POST",
				body: { favoritesOnly: false },
			});
			const data = resp.body as {
				entries: Array<{ type: string; data: Record<string, unknown> }>;
			};
			const demoEntries: Conversation[] = data.entries.map((e) => ({
				type: e.type,
				data: {
					...e.data,
					participants: (
						e.data.participants as Array<Record<string, unknown>>
					).map((p) => ({
						...p,
						lastOnline: p.lastOnline as number,
						onlineUntil: p.onlineUntil as number | null,
					})),
				},
			}));
			set({ entries: demoEntries, loading: false });
		} catch (err) {
			set({
				error:
					err instanceof Error
						? err
						: new Error("Failed to load conversations"),
				loading: false,
			});
		}
	},

	remove(conversationId: string) {
		const { entries } = get();
		const index = entries.findIndex(
			(e) => e.data.conversationId === conversationId,
		);
		if (index === -1) return;
		const newEntries = [...entries.slice(0, index), ...entries.slice(index + 1)];
		set({ entries: newEntries });
	},

	sortEntries() {
		const { entries } = get();
		const sorted = [...entries].sort(
			(a: Conversation, b: Conversation) =>
				Number(b.data.pinned) - Number(a.data.pinned) ||
				b.data.lastActivityTimestamp - a.data.lastActivityTimestamp,
		);
		set({ entries: sorted });
	},

	updatePreview({ conversationId, preview, timestamp }) {
		const { entries } = get();
		const entry = entries.find((e) => e.data.conversationId === conversationId);
		if (!entry) return;
		entry.data.preview = preview;
		entry.data.lastActivityTimestamp = timestamp;
		get().sortEntries();
	},

	setPinned({ conversationIds, pinned }) {
		const { entries } = get();
		const newEntries = entries.map((entry) => {
			if (conversationIds.includes(entry.data.conversationId)) {
				return {
					...entry,
					data: { ...entry.data, pinned },
				};
			}
			return entry;
		});
		set({ entries: newEntries });
		get().sortEntries();
	},

	setMuted({ conversationIds, muted }) {
		const { entries } = get();
		const newEntries = entries.map((entry) => {
			if (conversationIds.includes(entry.data.conversationId)) {
				return {
					...entry,
					data: { ...entry.data, muted },
				};
			}
			return entry;
		});
		set({ entries: newEntries });
	},
}));
