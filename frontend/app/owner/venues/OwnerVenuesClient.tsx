"use client";

import { useState } from "react";
import Link from "next/link";
import { delJSON } from "../../lib/api";

type Venue = {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  basePrice: number;
};

export default function OwnerVenuesClient({ initial }: { initial: Venue[] }) {
  const [items, setItems] = useState<Venue[]>(initial);

  async function onDelete(id: string) {
    const ok = confirm("Are you sure you want to delete this venue?");
    if (!ok) return;
    const prev = items;
    setItems(items.filter(v => v.id !== id));
    try {
      await delJSON(`/api/venues/${id}`);
    } catch (e) {
      alert((e as Error).message || "Delete failed");
      setItems(prev);
    }
  }

  if (items.length === 0) {
    return (
      <>
        <div style={{ margin: '8px 0' }}>
          <Link href="/owner/venues/new" data-testid="link-new-venue">+ Create new venue</Link>
        </div>
        <p data-testid="owner-empty">You have no venues yet.</p>
      </>
    );
  }

  return (
    <>
      <div style={{ margin: '8px 0' }}>
        <Link href="/owner/venues/new" data-testid="link-new-venue">+ Create new venue</Link>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Name</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>City</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Capacity</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Base Price</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id} data-testid="owner-venue-row">
              <td style={{ padding: "6px 8px" }}>{v.name}</td>
              <td style={{ padding: "6px 8px" }}>{v.city}, {v.country}</td>
              <td style={{ padding: "6px 8px" }}>{v.capacity}</td>
              <td style={{ padding: "6px 8px" }}>£{v.basePrice}</td>
              <td style={{ padding: "6px 8px", display: 'flex', gap: 8 }}>
                <Link href={`/owner/venues/${v.id}/edit`} data-testid={`link-edit-${v.id}`}>Edit</Link>
                <button type="button" data-testid={`btn-delete-${v.id}`} onClick={() => onDelete(v.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
