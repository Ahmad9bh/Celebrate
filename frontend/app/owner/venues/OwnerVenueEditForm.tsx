"use client";
import React from "react";
import { putJSON } from "../../lib/api";
import { useRouter } from "next/navigation";

type Venue = {
  id: string;
  name: string;
  description?: string | null;
  city: string;
  country: string;
  capacity: number;
  basePrice: number;
};

export default function OwnerVenueEditForm({ initial }: { initial: Venue }) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: initial.name || "",
    description: initial.description || "",
    city: initial.city || "",
    country: initial.country || "",
    capacity: initial.capacity || 0,
    basePrice: initial.basePrice || 0,
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
      };
      await putJSON(`/api/venues/${initial.id}`, body);
      router.push("/owner/venues");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to update venue");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <h3>Edit Venue</h3>
      {error && <p style={{ color: "#b00" }}>{error}</p>}
      <label>
        Name
        <input data-testid="edit-venue-name" type="text" required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label>
        Description
        <textarea data-testid="edit-venue-description" value={form.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label>
        City
        <input data-testid="edit-venue-city" type="text" required value={form.city} onChange={(e) => set("city", e.target.value)} />
      </label>
      <label>
        Country
        <input data-testid="edit-venue-country" type="text" required value={form.country} onChange={(e) => set("country", e.target.value)} />
      </label>
      <label>
        Capacity
        <input data-testid="edit-venue-capacity" type="number" min={0} required value={form.capacity} onChange={(e) => set("capacity", e.target.valueAsNumber)} />
      </label>
      <label>
        Base Price (GBP)
        <input data-testid="edit-venue-basePrice" type="number" min={0} required value={form.basePrice} onChange={(e) => set("basePrice", e.target.valueAsNumber)} />
      </label>
      <button data-testid="edit-venue-submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </form>
  );
}
