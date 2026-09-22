/**
 * Home Screen Widget — 27.3
 * Shows new matches, unread counts, or one profile card to like without opening app.
 * Refreshed via push + lightweight API.
 */

export type WidgetData = {
  userId: string;
  newMatches: number;
  unreadMessages: number;
  likesYou: number;
  featuredProfile?: {
    id: string;
    displayName: string;
    avatar: string;
    age: number;
    distance?: number;
  };
  updatedAt: string;
};

export type WidgetConfig = {
  enabled: boolean;
  showMatches: boolean;
  showUnread: boolean;
  showLikes: boolean;
  showFeatured: boolean;
  refreshIntervalMinutes: number;
};

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  enabled: true,
  showMatches: true,
  showUnread: true,
  showLikes: true,
  showFeatured: true,
  refreshIntervalMinutes: 15,
};

export function createWidgetData(params: {
  userId: string;
  newMatches: number;
  unreadMessages: number;
  likesYou: number;
  featuredProfile?: WidgetData["featuredProfile"];
}): WidgetData {
  return {
    userId: params.userId,
    newMatches: params.newMatches,
    unreadMessages: params.unreadMessages,
    likesYou: params.likesYou,
    featuredProfile: params.featuredProfile,
    updatedAt: new Date().toISOString(),
  };
}

export function shouldRefreshWidget(lastUpdatedAt: string, intervalMinutes: number): boolean {
  const elapsed = Date.now() - new Date(lastUpdatedAt).getTime();
  return elapsed > intervalMinutes * 60 * 1000;
}

export function getWidgetDisplayText(data: WidgetData, config: WidgetConfig): string {
  const parts: string[] = [];
  if (config.showMatches && data.newMatches > 0) parts.push(`${data.newMatches} new matches`);
  if (config.showUnread && data.unreadMessages > 0) parts.push(`${data.unreadMessages} unread`);
  if (config.showLikes && data.likesYou > 0) parts.push(`${data.likesYou} likes you`);
  return parts.length > 0 ? parts.join(" • ") : "No new activity";
}
