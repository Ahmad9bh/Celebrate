"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function SearchControls({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q || "");
  const [city, setCity] = useState(initial.city || "");
  const [minCap, setMinCap] = useState(initial.minCap || "");

  const dq = useDebounced(q);
  const dcity = useDebounced(city);
  const dminCap = useDebounced(minCap);

  // Build next URL when debounced values change
  useEffect(() => {
    const params = new URLSearchParams(sp?.toString() || "");
    function setOrDelete(key: string, val: string) {
      if (val && val.trim()) params.set(key, val.trim());
      else params.delete(key);
    }
    setOrDelete("q", dq);
    setOrDelete("city", dcity);
    setOrDelete("minCap", dminCap);
    const qs = params.toString();
    router.replace(`/search${qs ? `?${qs}` : ""}`);
  }, [dq, dcity, dminCap]);

  return (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input name="q" placeholder="Keyword" value={q} onChange={(e) => setQ(e.target.value)} />{" "}
      <input name="city" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />{" "}
      <input name="minCap" placeholder="Min capacity" value={minCap} onChange={(e) => setMinCap(e.target.value)} />
    </form>
  );
}
