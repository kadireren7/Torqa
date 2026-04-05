export type Locale = "en" | "tr";

export const LOCALE_STORAGE_KEY = "torqa-desktop-locale";

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function detectLocale(): Locale {
  try {
    const s = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (s === "tr" || s === "en") return s;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("tr")) return "tr";
  return "en";
}
