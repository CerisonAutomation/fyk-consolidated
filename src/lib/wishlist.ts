/**
 * Shared Wishlist / Date Ideas Board — 27.6
 * Private list of date ideas both users can add to and vote on.
 * Constraint set that feeds AI Date Planner (25.3)
 */

export type WishlistItem = {
  id: string;
  text: string;
  addedBy: string;
  votes: string[]; // userIds who voted
  category: string;
  createdAt: string;
};

export type SharedWishlist = {
  id: string;
  participants: string[]; // 2 userIds
  items: WishlistItem[];
  createdAt: string;
  updatedAt: string;
};

export function createWishlist(participantA: string, participantB: string): SharedWishlist {
  return {
    id: crypto.randomUUID(),
    participants: [participantA, participantB].sort(),
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function addWishlistItem(wishlist: SharedWishlist, text: string, addedBy: string, category = "general"): WishlistItem {
  const item: WishlistItem = {
    id: crypto.randomUUID(),
    text: text.slice(0, 200),
    addedBy,
    votes: [addedBy],
    category,
    createdAt: new Date().toISOString(),
  };
  wishlist.items.push(item);
  wishlist.updatedAt = new Date().toISOString();
  return item;
}

export function voteWishlistItem(wishlist: SharedWishlist, itemId: string, voterId: string): boolean {
  const item = wishlist.items.find((i) => i.id === itemId);
  if (!item) return false;
  if (!item.votes.includes(voterId)) {
    item.votes.push(voterId);
  }
  wishlist.updatedAt = new Date().toISOString();
  return true;
}

export function getTopWishlistItems(wishlist: SharedWishlist, limit = 5): WishlistItem[] {
  return [...wishlist.items].sort((a, b) => b.votes.length - a.votes.length).slice(0, limit);
}

export function wishlistToDatePlannerInput(wishlist: SharedWishlist): string[] {
  return wishlist.items.map((i) => i.text);
}
