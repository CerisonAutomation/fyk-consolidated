/**
 * Social Links & Profile Depth — Production implementation
 * Handles Instagram, Twitter/X, TikTok, Bluesky, Telegram, WhatsApp, Spotify
 */

import { SocialPlatform } from "./enums";

export type SocialLink = {
  platform: SocialPlatform;
  url: string;
  handle?: string;
  verified?: boolean;
};

const PLATFORM_PATTERNS: Record<SocialPlatform, { regex: RegExp; baseUrl: string; deepLink: (handle: string) => string }> = {
  [SocialPlatform.INSTAGRAM]: {
    regex: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?$/,
    baseUrl: "https://instagram.com/",
    deepLink: (h) => `instagram://user?username=${h}`,
  },
  [SocialPlatform.TWITTER]: {
    regex: /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/,
    baseUrl: "https://x.com/",
    deepLink: (h) => `twitter://user?screen_name=${h}`,
  },
  [SocialPlatform.TIKTOK]: {
    regex: /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)\/?$/,
    baseUrl: "https://tiktok.com/@",
    deepLink: (h) => `snssdk1233://user/profile/${h}`,
  },
  [SocialPlatform.BLUESKY]: {
    regex: /^(?:https?:\/\/)?bsky\.app\/profile\/([a-zA-Z0-9.-]+)\/?$/,
    baseUrl: "https://bsky.app/profile/",
    deepLink: (h) => `bluesky://profile/${h}`,
  },
  [SocialPlatform.TELEGRAM]: {
    regex: /^(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]+)\/?$/,
    baseUrl: "https://t.me/",
    deepLink: (h) => `tg://resolve?domain=${h}`,
  },
  [SocialPlatform.WHATSAPP]: {
    regex: /^(?:https?:\/\/)?wa\.me\/(\+?[0-9]+)\/?$/,
    baseUrl: "https://wa.me/",
    deepLink: (h) => `whatsapp://send?phone=${h}`,
  },
  [SocialPlatform.SPOTIFY]: {
    regex: /^(?:https?:\/\/)?open\.spotify\.com\/(?:user|track|artist)\/([a-zA-Z0-9]+)\/?$/,
    baseUrl: "https://open.spotify.com/user/",
    deepLink: (h) => `spotify://user/${h}`,
  },
};

export function parseSocialLink(input: string): { platform: SocialPlatform; handle: string; url: string } | null {
  for (const [platform, config] of Object.entries(PLATFORM_PATTERNS) as [SocialPlatform, typeof PLATFORM_PATTERNS[SocialPlatform]][]) {
    const match = input.trim().match(config.regex);
    if (match) {
      const handle = match[1];
      return {
        platform,
        handle,
        url: `${config.baseUrl}${handle}`,
      };
    }
  }
  return null;
}

export function validateSocialLinks(links: SocialLink[]): { valid: SocialLink[]; invalid: SocialLink[] } {
  const valid: SocialLink[] = [];
  const invalid: SocialLink[] = [];
  for (const link of links) {
    const parsed = parseSocialLink(link.url);
    if (parsed && parsed.platform === link.platform) {
      valid.push({ ...link, url: parsed.url, handle: parsed.handle });
    } else {
      invalid.push(link);
    }
  }
  return { valid, invalid };
}

export function getDeepLink(platform: SocialPlatform, handle: string): string {
  const config = PLATFORM_PATTERNS[platform];
  return config ? config.deepLink(handle) : `https://${platform}.com/${handle}`;
}

export function sanitizeSocialLinksForPublic(links: SocialLink[]): { platform: SocialPlatform; url: string; handle?: string }[] {
  // Never expose verification tokens, only public URLs
  return links.map((l) => ({
    platform: l.platform,
    url: l.url,
    handle: l.handle,
  }));
}
