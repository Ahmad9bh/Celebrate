import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function getBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
}

function getAuthHeaderFromCookies() {
  const token = cookies().get("token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;
}

export async function apiFetchServer(path: string, init: RequestInit = {}, opts: { requireAuth?: boolean } = {}) {
  const base = getBase();
  const headers = new Headers(init.headers as HeadersInit);
  const auth = getAuthHeaderFromCookies();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));

  if (opts.requireAuth && !headers.get("Authorization")) {
    return redirect("/auth");
  }

  const res = await fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
  if (opts.requireAuth && res.status === 401) {
    return redirect("/auth");
  }
  return res;
}

export async function getJSONServer<T = any>(path: string, opts: { requireAuth?: boolean } = {}): Promise<T> {
  const res = await apiFetchServer(path, {}, opts);
  if (!res.ok) {
    // Let caller decide; for protected endpoints with requireAuth we already redirected above
    const text = await res.text().catch(() => "");
    throw new Error(text || `GET ${path} failed with ${res.status}`);
  }
  return res.json();
}
