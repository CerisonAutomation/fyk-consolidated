import { api } from "#/lib/client";

/**
 * The King Pet screen's API client.
 *
 * Replaces `src/integrations/supabase/king-pet.ts` (380 lines), which ran the
 * game in the browser: it wrote `king_pet.xp`/`level`/`streak` straight from the
 * client, minted bones into `wallet.balance`, and paid for shop items with a
 * `wallet_transactions` row whose `type` the database CHECK had never accepted —
 * so the bones left and the record of them leaving did not exist. `0019` made the
 * pet read-only for a browser token and this module is the only writer left.
 *
 * Progression, cooldowns and adventure completion now happen server-side
 * (`src/routes/api/king-pet/index.ts`), and the wallet is the only balance.
 */

export type PetView = {
	name: string;
	stage: string;
	mood: string;
	/** The wallet's balance, not a second number (0019 dropped `king_pet.bones`). */
	bones: number;
	experience: number;
	level: number;
	streak: number;
	wardrobe: string[];
	equipped: string[];
	adventures: string[];
	mood_log: { mood: string; time: string }[];
};

export type PetShopItem = {
	id: string;
	name: string;
	type: string;
	emoji: string;
	bone_cost: number;
	stage_required: string;
};

export type PetAdventure = {
	id: string;
	theme: string;
	description: string;
	emoji: string;
	duration_minutes: number;
	bone_cost: number;
	reward_type: string;
	reward_amount: number;
};

export type PendingAdventure = {
	theme: string;
	emoji: string;
	startedAt: string;
	endsAt: string;
	rewardType: "xp" | "bones";
	rewardAmount: number;
};

export type PetPayload = {
	pet: PetView;
	items: PetShopItem[];
	adventures: PetAdventure[];
	bones: number;
	pending: PendingAdventure | null;
	justCompleted: {
		theme: string;
		emoji: string;
		rewardType: string;
		rewardAmount: number;
	} | null;
};

export type PetAction =
	| { action: "feed" | "play" | "rest" | "dress" }
	| { action: "equip"; name: string }
	| { action: "buyItem"; itemId: string }
	| { action: "adventure"; adventureId: string }
	| { action: "rename"; name: string };

export type PetActionResult = {
	ok: boolean;
	pet: PetView;
	bones: number;
	leveledUp: boolean;
	pending: PendingAdventure | null;
	reward?: { type: string; amount: number; theme: string };
};

export function loadPetData(): Promise<PetPayload> {
	return api.get<PetPayload>("/api/king-pet");
}

export function performPetAction(action: PetAction): Promise<PetActionResult> {
	return api.post("/api/king-pet", action);
}
