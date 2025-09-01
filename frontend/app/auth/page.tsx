"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/ToastContext";
import { postJSON } from "../lib/api";

export default function AuthPage() {
  const [email, setEmail] = useState("alice@example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { show } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await postJSON("/api/auth/login", { email });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      try {
        // Set cookie for SSR guards (30 days)
        document.cookie = `token=${encodeURIComponent(data.token)}; Path=/; Max-Age=${60*60*24*30}`;
      } catch {}
      show("Signed in successfully", "success");
      // Optional returnTo support from query string
      try {
        const u = new URL(window.location.href);
        const returnTo = u.searchParams.get("returnTo");
        router.push(returnTo || "/");
      } catch {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
      show(err.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <p>Use any email from seed, e.g. alice@example.com, owner@example.com, admin@example.com</p>
      <form onSubmit={onSubmit} style={{display:"flex", gap:8, alignItems:"center"}}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      {error && <p style={{color:"crimson"}}>{error}</p>}
    </div>
  );
}
