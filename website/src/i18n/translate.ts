import type { Locale, Translate } from "./types";
import { messagesEn } from "./en";
import { messagesTr } from "./tr";

const byLocale: Record<Locale, Record<string, string>> = {
  en: messagesEn,
  tr: messagesTr,
};

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : `{${k}}`,
  );
}

export function createTranslate(locale: Locale): Translate {
  const primary = byLocale[locale];
  const fallback = byLocale.en;
  return (key: string, vars?: Record<string, string | number>) => {
    const raw = primary[key] ?? fallback[key] ?? key;
    return interpolate(raw, vars);
  };
}
