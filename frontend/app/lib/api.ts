// Simple API helper for client components
// - Automatically attaches Authorization header from localStorage if present
// - Uses NEXT_PUBLIC_API_BASE for base URL
// - Provides getJSON/postJSON with basic error handling

export type Json = Record<string, any> | any[] | string | number | boolean | null;

function getBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
}

function getAuthHeader() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {} as Record<string, string>;
  }
}

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Expire cookie if it exists
    document.cookie = "token=; Path=/; Max-Age=0";
  } catch {}
  const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  const dest = `/auth?returnTo=${returnTo}`;
  // Avoid infinite redirect loop if already on /auth
  if (!window.location.pathname.startsWith("/auth")) {
    window.location.href = dest;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const base = getBase();
  const headers = new Headers(init.headers as HeadersInit);
  const auth = getAuthHeader();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }
  return res;
}

export async function getJSON<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `GET ${path} failed with ${res.status}`);
  }
  return res.json();
}

export async function postJSON<T = any>(path: string, body?: Json): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `POST ${path} failed with ${res.status}`);
  }
  return res.json();
}

export async function delJSON<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `DELETE ${path} failed with ${res.status}`);
  }
  return res.json();
}
