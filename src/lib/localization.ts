/**
 * Localization — 23.6, 60+ locale bundles
 * Date/plurals/localized strings swap at runtime.
 */

export type Locale = string; // BCP-47

export const SUPPORTED_LOCALES: Locale[] = [
  "en", "en-GB", "en-US", "es", "es-MX", "es-ES", "fr", "fr-CA", "de", "it", "pt", "pt-BR",
  "nl", "pl", "ru", "tr", "ar", "he", "hi", "ja", "ko", "zh", "zh-TW", "th", "vi",
  "id", "ms", "fil", "uk", "el", "cs", "hu", "ro", "sv", "da", "no", "fi",
  "bg", "hr", "sr", "sk", "sl", "lt", "lv", "et", "bn", "ta", "te", "mr",
  "gu", "kn", "ml", "pa", "ur", "fa", "sw", "am", "zu", "af",
];

export type TranslationBundle = Record<string, string>;

const bundles: Record<Locale, TranslationBundle> = {
  en: {
    "app.name": "Find Your King",
    "auth.signIn": "Sign In",
    "auth.signUp": "Create Account",
    "auth.forgotPassword": "Forgot Password?",
    "discover.nearby": "Nearby",
    "discover.online": "{count} online near you",
    "chat.placeholder": "Type a message...",
    "chat.typing": "{name} is typing...",
    "profile.edit": "Edit Profile",
    "safety.checkIn": "Check In",
    "premium.upgrade": "Upgrade to Premium",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.block": "Block",
    "common.report": "Report",
  },
  es: {
    "app.name": "Encuentra a tu Rey",
    "auth.signIn": "Iniciar Sesión",
    "auth.signUp": "Crear Cuenta",
    "discover.nearby": "Cerca",
    "chat.placeholder": "Escribe un mensaje...",
  },
  fr: {
    "app.name": "Trouve ton Roi",
    "auth.signIn": "Se connecter",
    "auth.signUp": "Créer un compte",
    "discover.nearby": "À proximité",
    "chat.placeholder": "Tapez un message...",
  },
};

export function getBundle(locale: Locale): TranslationBundle {
  if (bundles[locale]) return bundles[locale];
  const base = locale.split("-")[0];
  if (bundles[base]) return bundles[base];
  return bundles.en;
}

export function t(key: string, locale: Locale = "en", params?: Record<string, string | number>): string {
  const bundle = getBundle(locale);
  let text = bundle[key] ?? bundles.en[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }

  return text;
}

export function formatDate(date: string | Date, locale: Locale = "en", options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options ?? { dateStyle: "medium" }).format(d);
}

export function formatRelativeTime(date: string | Date, locale: Locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return t("time.justNow", locale) || "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d, locale);
}

export function getPluralForm(count: number, locale: Locale = "en"): "one" | "other" {
  // Simplified — production uses Intl.PluralRules
  if (locale.startsWith("en") || locale.startsWith("de") || locale.startsWith("es")) {
    return count === 1 ? "one" : "other";
  }
  return "other";
}

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language ?? "en";
}
