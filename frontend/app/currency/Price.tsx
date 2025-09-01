"use client";
import { useCurrency } from "./CurrencyContext";

export default function Price({ amountGBP, prefix = "From " }: { amountGBP: number; prefix?: string }) {
  const { format } = useCurrency();
  return <span>{prefix}{format(amountGBP)}</span>;
}
