/**
 * translate.ts
 * Dictionary-based translation for ES/FR/DE/PT/IT.
 * 16 common words per language.
 */

export type SupportedLang = "es" | "fr" | "de" | "pt" | "it";

interface TranslationDict {
  [word: string]: string;
}

const DICTIONARIES: Record<SupportedLang, TranslationDict> = {
  es: {
    hello: "hola",
    goodbye: "adios",
    yes: "si",
    no: "no",
    please: "por favor",
    thanks: "gracias",
    sorry: "lo siento",
    help: "ayuda",
    love: "amor",
    friend: "amigo",
    beautiful: "hermoso",
    today: "hoy",
    tonight: "esta noche",
    meet: "conocer",
    drink: "tomar",
    food: "comida",
  },
  fr: {
    hello: "bonjour",
    goodbye: "au revoir",
    yes: "oui",
    no: "non",
    please: "s'il vous plait",
    thanks: "merci",
    sorry: "desole",
    help: "aide",
    love: "amour",
    friend: "ami",
    beautiful: "beau",
    today: "aujourd'hui",
    tonight: "ce soir",
    meet: "rencontrer",
    drink: "boire",
    food: "nourriture",
  },
  de: {
    hello: "hallo",
    goodbye: "auf wiedersehen",
    yes: "ja",
    no: "nein",
    please: "bitte",
    thanks: "danke",
    sorry: "entschuldigung",
    help: "hilfe",
    love: "liebe",
    friend: "freund",
    beautiful: "schon",
    today: "heute",
    tonight: "heute abend",
    meet: "treffen",
    drink: "trinken",
    food: "essen",
  },
  pt: {
    hello: "ola",
    goodbye: "adeus",
    yes: "sim",
    no: "nao",
    please: "por favor",
    thanks: "obrigado",
    sorry: "desculpa",
    help: "ajuda",
    love: "amor",
    friend: "amigo",
    beautiful: "lindo",
    today: "hoje",
    tonight: "esta noite",
    meet: "encontrar",
    drink: "beber",
    food: "comida",
  },
  it: {
    hello: "ciao",
    goodbye: "arrivederci",
    yes: "si",
    no: "no",
    please: "per favore",
    thanks: "grazie",
    sorry: "scusa",
    help: "aiuto",
    love: "amore",
    friend: "amico",
    beautiful: "bello",
    today: "oggi",
    tonight: "stasera",
    meet: "incontrare",
    drink: "bere",
    food: "cibo",
  },
};

export function translate(text: string, lang: SupportedLang): string {
  const dict = DICTIONARIES[lang];
  if (!dict) return text;

  const words = text.split(/(\s+)/);
  const translated = words.map((w) => {
    if (/^\s+$/.test(w)) return w;
    const lower = w.toLowerCase();
    const clean = lower.replace(/[^a-z]/g, "");
    const result = dict[clean];
    if (result) {
      if (w.charAt(0) === w.charAt(0).toUpperCase() && w.charAt(0) !== w.charAt(0).toLowerCase()) {
        return result.charAt(0).toUpperCase() + result.slice(1);
      }
      return result;
    }
    return w;
  });

  return translated.join("");
}
