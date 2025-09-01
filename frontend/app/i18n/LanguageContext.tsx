"use client";
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type Lang = "en" | "ar";

type Dict = Record<string, Record<Lang, string>>;

const DICT: Dict = {
  title: { en: "Find the perfect venue for your celebration", ar: "اعثر على المكان المثالي لاحتفالك" },
  subtitle: { en: "Search venues by city, date, capacity, amenities, and more.", ar: "ابحث عن القاعات حسب المدينة، التاريخ، السعة، المرافق وغيرها." },
  search: { en: "Search", ar: "بحث" },
  anyEvent: { en: "Any event", ar: "أي مناسبة" },
  cityPlaceholder: { en: "City (e.g. London, Dubai)", ar: "المدينة (مثال: لندن، دبي)" },
  popularLondon: { en: "Popular: London", ar: "الأشهر: لندن" },
  dubai: { en: "Dubai", ar: "دبي" },
  bookThisVenue: { en: "Book this venue", ar: "احجز هذا المكان" },
  basePrice: { en: "Base price", ar: "السعر الأساسي" },
  bookAndPay: { en: "Book & Pay", ar: "احجز وادفع" },
};

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT) => string;
}

const LanguageContext = createContext<LanguageCtx | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("lang") as Lang | null) : null;
    if (saved) setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch {}
  };

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key: keyof typeof DICT) => DICT[key]?.[lang] ?? String(key),
  }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
