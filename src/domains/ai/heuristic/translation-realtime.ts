/**
 * Real-Time Neural Translation — 25.8
 * Messages translate in-line per bubble with auto source-language detection.
 */

export type TranslationResult = {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;
  model: "server" | "on_device";
};

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
] as const;

const ON_DEVICE_LANGS = ["en", "es", "fr", "de", "it", "pt", "ja", "zh"];

const TRANSLATION_DICT: Record<string, Record<string, string>> = {
  en: {
    "hola": "hello",
    "bonjour": "hello",
    "hallo": "hello",
    "ciao": "hello",
    "como estas": "how are you",
    "comment ça va": "how are you",
  },
};

export function detectLanguage(text: string): { lang: string; confidence: number } {
  const lower = text.toLowerCase();

  // Simple heuristic — production uses fasttext or cld3
  if (/[áéíóúñ]/.test(lower) || lower.includes("hola") || lower.includes("como")) {
    return { lang: "es", confidence: 0.8 };
  }
  if (/[àèéêë]/.test(lower) || lower.includes("bonjour") || lower.includes("comment")) {
    return { lang: "fr", confidence: 0.8 };
  }
  if (/[äöüß]/.test(lower) || lower.includes("hallo")) {
    return { lang: "de", confidence: 0.7 };
  }
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return { lang: "ja", confidence: 0.9 };
  }
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return { lang: "zh", confidence: 0.9 };
  }

  return { lang: "en", confidence: 0.6 };
}

export function translateText(text: string, targetLang: string): TranslationResult {
  const detection = detectLanguage(text);
  const sourceLang = detection.lang;

  if (sourceLang === targetLang) {
    return {
      original: text,
      translated: text,
      sourceLang,
      targetLang,
      confidence: 1,
      model: "on_device",
    };
  }

  // Check dict
  const lower = text.toLowerCase().trim();
  const dict = TRANSLATION_DICT[sourceLang] ?? {};
  const translated = dict[lower] ?? `[Translated to ${targetLang}] ${text}`;

  const model = ON_DEVICE_LANGS.includes(sourceLang) && ON_DEVICE_LANGS.includes(targetLang) ? "on_device" : "server";

  return {
    original: text,
    translated,
    sourceLang,
    targetLang,
    confidence: detection.confidence,
    model,
  };
}

export function translateBatch(messages: { id: string; text: string }[], targetLang: string): TranslationResult[] {
  return messages.map((m) => translateText(m.text, targetLang));
}
