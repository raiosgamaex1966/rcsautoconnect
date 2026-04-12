import ptBr from "./pt-br";
import en from "./en";
import es from "./es";

export type Translations = typeof ptBr;
export type Language = "pt-br" | "en" | "es";

const translations: Record<Language, Translations> = {
  "pt-br": ptBr,
  en: en as unknown as Translations,
  es: es as unknown as Translations,
};

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations["pt-br"];
}

export const languageLabels: Record<Language, string> = {
  "pt-br": "Português (Brasil)",
  en: "English",
  es: "Español",
};
