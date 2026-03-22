import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { AppLanguage } from "./translations";
import { translations } from "./translations";

interface I18nContextValue {
  language: AppLanguage;
  isRtl: boolean;
  t: (key: string) => string;
  setLanguage: (language: AppLanguage) => void;
}

const STORAGE_KEY = "corehr-language";
const DEFAULT_LANGUAGE: AppLanguage = "en";

const I18nContext = createContext<I18nContextValue | null>(null);

const normalizeLanguage = (value: unknown): AppLanguage => (value === "ar" ? "ar" : "en");

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const fromStorage = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return normalizeLanguage(fromStorage ?? DEFAULT_LANGUAGE);
  });

  useEffect(() => {
    const preferred = normalizeLanguage(user?.preferred_language ?? null);
    setLanguageState((current) => (current === preferred ? current : preferred));
  }, [user?.preferred_language]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, language);
    }

    const dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = translations[language] ?? translations.en;

    return {
      language,
      isRtl: language === "ar",
      t: (key: string) => dictionary[key] ?? translations.en[key] ?? key,
      setLanguage: (nextLanguage: AppLanguage) => setLanguageState(normalizeLanguage(nextLanguage)),
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
}

