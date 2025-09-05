"use client";
import React from "react";
import { postJSON } from "../../lib/api";
import { useRouter } from "next/navigation";

export default function OwnerVenueForm() {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    city: "",
    country: "",
    capacity: 0,
    basePrice: 0,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description,
        city: form.city,
        country: form.country,
        capacity: Number(form.capacity),
        basePrice: Number(form.basePrice),
        images: [],
        amenities: [],
        eventTypes: [],
      };
      await postJSON("/api/venues", body);
      router.push("/owner/venues");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to create venue");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <h3>Create Venue</h3>
      {error && <p style={{ color: "#b00" }}>{error}</p>}
      <label>
        Name
        <input data-testid="venue-name" type="text" required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label>
        Description
        <textarea data-testid="venue-description" value={form.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label>
        City
        <input data-testid="venue-city" type="text" required value={form.city} onChange={(e) => set("city", e.target.value)} />
      </label>
      <label>
        Country
        <input data-testid="venue-country" type="text" required value={form.country} onChange={(e) => set("country", e.target.value)} />
      </label>
      <label>
        Capacity
        <input data-testid="venue-capacity" type="number" min={0} required value={form.capacity} onChange={(e) => set("capacity", e.target.valueAsNumber)} />
      </label>
      <label>
        Base Price (GBP)
        <input data-testid="venue-basePrice" type="number" min={0} required value={form.basePrice} onChange={(e) => set("basePrice", e.target.valueAsNumber)} />
      </label>
      <button data-testid="venue-submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</button>
    </form>
  );
}
