"use client";
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Currency = "GBP" | "AED" | "SAR" | "QAR";

const DEFAULT_RATES: Record<Currency, number> = {
  GBP: 1,
  AED: 4.7,   // example static rates
  SAR: 4.65,
  QAR: 4.5,
};

export function convertFromGBP(amountGBP: number, to: Currency): number {
  const rates = getCachedRates();
  return Math.round(amountGBP * rates[to] * 100) / 100;
}

export function formatCurrency(amountGBP: number, to: Currency): string {
  const map: Record<Currency, string> = { GBP: "GBP", AED: "AED", SAR: "SAR", QAR: "QAR" };
  const value = convertFromGBP(amountGBP, to).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const symbol: Record<Currency, string> = { GBP: "£", AED: "AED ", SAR: "SAR ", QAR: "QAR " };
  return `${symbol[to]}${value}`;
}

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  format: (amountGBP: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

type RatePayload = { base: string; rates: Record<string, number>; fetchedAt: number };
const LS_KEY = "currency_rates_v1";

function getCachedRates(): Record<Currency, number> {
  if (typeof window === "undefined") return DEFAULT_RATES;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_RATES;
    const parsed: RatePayload = JSON.parse(raw);
    const map: Partial<Record<Currency, number>> = {};
    // Expecting GBP base; convert target from GBP
    (Object.keys(DEFAULT_RATES) as Currency[]).forEach((c) => {
      if (c === "GBP") map[c] = 1;
      else map[c] = parsed.rates[c] ?? DEFAULT_RATES[c];
    });
    return map as Record<Currency, number>;
  } catch {
    return DEFAULT_RATES;
  }
}

async function fetchRates(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // Free endpoints often restrict usage; you can plug your own provider here.
    // For demo: use exchangerate.host with base GBP.
    const res = await fetch("https://api.exchangerate.host/latest?base=GBP");
    if (!res.ok) throw new Error("rate fetch failed");
    const data = await res.json();
    const payload: RatePayload = { base: data.base || "GBP", rates: data.rates || {}, fetchedAt: Date.now() };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // Keep previous cache or defaults
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("GBP");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("currency") as Currency | null) : null;
    if (saved) setCurrencyState(saved);
  }, []);

  // Rates boot + periodic refresh (every 12h)
  useEffect(() => {
    fetchRates();
    const id = setInterval(fetchRates, 12 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem("currency", c); } catch {}
  };

  const value = useMemo(() => ({
    currency,
    setCurrency,
    format: (amountGBP: number) => formatCurrency(amountGBP, currency),
  }), [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

