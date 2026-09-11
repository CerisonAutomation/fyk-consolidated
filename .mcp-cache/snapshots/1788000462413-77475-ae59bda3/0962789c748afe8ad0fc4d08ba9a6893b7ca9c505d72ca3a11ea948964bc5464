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

	setEntries: (entries: Conversation[]) => void;
	setNextPage: (page: number | null) => void;
	setLoading: (loading: boolean) => void;
	setRefreshing: (refreshing: boolean) => void;
	setError: (error: Error | null) => void;
	setActive: (conversationId: string | null) => void;
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
	setFilters: (filters) => set({ filters }),
	setOurProfileId: (id) => set({ ourProfileId: id }),

	remove(conversationId) {
		const { entries } = get();
		const index = entries.findIndex(
			(e) => e.data.conversationId === conversationId,
		);
		if (index === -1) return;
		const newEntries = [...entries];
		newEntries.splice(index, 1);
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
