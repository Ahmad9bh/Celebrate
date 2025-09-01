"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrency, Currency } from "./currency/CurrencyContext";
import { useLanguage } from "./i18n/LanguageContext";

export default function HeaderClient() {
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const { lang, setLang } = useLanguage();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    try {
      // Expire cookie
      document.cookie = "token=; Path=/; Max-Age=0";
    } catch {}
    setUser(null);
    router.refresh();
  }

  const currencyPicker = (
    <select value={currency} onChange={(e)=>setCurrency(e.target.value as Currency)}>
      <option value="GBP">GBP</option>
      <option value="AED">AED</option>
      <option value="SAR">SAR</option>
      <option value="QAR">QAR</option>
    </select>
  );

  const langPicker = (
    <select value={lang} onChange={(e)=>setLang(e.target.value as any)}>
      <option value="en">EN</option>
      <option value="ar">AR</option>
    </select>
  );

  if (!user) {
    return (
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        {currencyPicker}
        {langPicker}
        <Link href="/auth">Login</Link>
      </div>
    );
  }

  return (
    <div style={{display:"flex",gap:12,alignItems:"center"}}>
      {currencyPicker}
      {langPicker}
      <span>Hi, {user.name || "User"} {user.role ? `• ${user.role}` : ""}</span>
      <Link href="/dashboard">My bookings</Link>
      {user.role === 'owner' && <Link href="/owner">Owner</Link>}
      {user.role === 'admin' && <Link href="/admin">Admin</Link>}
      <button onClick={logout}>Logout</button>
    </div>
  );
}
