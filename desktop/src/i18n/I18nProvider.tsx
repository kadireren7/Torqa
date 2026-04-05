import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale, Translate } from "./types";
import { LOCALE_STORAGE_KEY, detectLocale } from "./types";
import { createTranslate } from "./translate";

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window !== "undefined" ? detectLocale() : "en",
  );

  useEffect(() => {
    document.documentElement.lang = locale === "tr" ? "tr" : "en";
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useMemo(() => createTranslate(locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className={className ?? "i18n-lang-toggle"} role="group" aria-label={t("lang.switch")}>
      <button
        type="button"
        className={`i18n-lang-btn${locale === "en" ? " i18n-lang-btn--on" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        className={`i18n-lang-btn${locale === "tr" ? " i18n-lang-btn--on" : ""}`}
        onClick={() => setLocale("tr")}
        aria-pressed={locale === "tr"}
      >
        TR
      </button>
    </div>
  );
}
