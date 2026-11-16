import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MESSAGES, LOCALES, type Locale, type Messages } from "./messages";

const STORAGE_KEY = "cityhealer_lang"; // shared with the older workspace screens

interface I18n {
  locale: Locale;
  t: Messages;
  /** Switch language, keeping the current page, query and any page state. */
  switchLocale: (next: Locale) => void;
  /** Prefix a path with the current locale: href("/app") -> "/hi/app". */
  href: (path: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function localeFromPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return (LOCALES as string[]).includes(first) ? (first as Locale) : null;
}

export function storedLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "hi" || v === "en") return v;
  } catch {}
  return navigator.language?.toLowerCase().startsWith("hi") ? "hi" : "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const locale = localeFromPath(location.pathname) || storedLocale();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const value = useMemo<I18n>(() => ({
    locale,
    t: MESSAGES[locale],
    href: (path: string) => `/${locale}${path.startsWith("/") ? path : `/${path}`}`.replace(/\/$/, "") || `/${locale}`,
    switchLocale: (next: Locale) => {
      if (next === locale) return;
      const rest = location.pathname.replace(/^\/(en|hi)(?=\/|$)/, "");
      navigate(`/${next}${rest}${location.search}${location.hash}`, { replace: true, state: location.state });
    },
  }), [locale, location, navigate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside LocaleProvider");
  return v;
}
