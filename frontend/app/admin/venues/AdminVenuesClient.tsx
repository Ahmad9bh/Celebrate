"use client";

import { useMemo, useState, useTransition } from "react";
import { postJSON, delJSON } from "../../lib/api";

type Venue = {
  id: string;
  name: string;
  city: string;
  country: string;
  ownerId: string;
  capacity: number;
  basePrice: number;
  status?: string;
};

export default function AdminVenuesClient({ initial }: { initial: Venue[] }) {
  const [items, setItems] = useState<Venue[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "suspended">("all");

  async function act(id: string, action: "approve" | "suspend") {
    // optimistic
    const prev = items;
    const next = items.map(v => v.id === id ? { ...v, status: action === "approve" ? "approved" : "suspended" } : v);
    setItems(next);
    try {
      await postJSON(`/api/admin/venues/${id}/${action}`);
    } catch (e) {
      // revert on failure
      setItems(prev);
      alert((e as Error).message || `Failed to ${action}`);
    }
  }

  const visible = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(v => (v.status || "pending") === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const base = { all: items.length, pending: 0, approved: 0, suspended: 0 } as Record<string, number>;
    for (const v of items) {
      const s = (v.status || "pending") as "pending" | "approved" | "suspended";
      base[s]++;
    }
    return base;
  }, [items]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
        <button type="button" data-testid="filter-all" onClick={() => setFilter("all")} aria-pressed={filter==="all"}>
          All ({counts.all})
        </button>
        <button type="button" data-testid="filter-pending" onClick={() => setFilter("pending")} aria-pressed={filter==="pending"}>
          Pending ({counts.pending})
        </button>
        <button type="button" data-testid="filter-approved" onClick={() => setFilter("approved")} aria-pressed={filter==="approved"}>
          Approved ({counts.approved})
        </button>
        <button type="button" data-testid="filter-suspended" onClick={() => setFilter("suspended")} aria-pressed={filter==="suspended"}>
          Suspended ({counts.suspended})
        </button>
      </div>
      <table data-testid="admin-venues-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Name</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>City</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Owner</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Capacity</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Base Price</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Status</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((v) => (
            <tr key={v.id} data-testid="admin-venue-row">
              <td style={{ padding: "6px 8px" }}>{v.name}</td>
              <td style={{ padding: "6px 8px" }}>{v.city}, {v.country}</td>
              <td style={{ padding: "6px 8px" }}>{v.ownerId}</td>
              <td style={{ padding: "6px 8px" }}>{v.capacity}</td>
              <td style={{ padding: "6px 8px" }}>£{v.basePrice}</td>
              <td style={{ padding: "6px 8px" }}>
                <span data-testid="cell-status">{v.status || "pending"}</span>
              </td>
              <td style={{ padding: "6px 8px", display: 'flex', gap: 8 }}>
                <button type="button" data-testid="btn-approve" onClick={() => act(v.id, "approve")}>Approve</button>
                <button type="button" data-testid="btn-suspend" onClick={() => act(v.id, "suspend")}>Suspend</button>
                <button
                  type="button"
                  data-testid="btn-delete"
                  onClick={async () => {
                    const ok = confirm("Are you sure you want to delete this venue?");
                    if (!ok) return;
                    const prev = items;
                    setItems(items.filter(x => x.id !== v.id));
                    try {
                      await delJSON(`/api/venues/${v.id}`);
                    } catch (e) {
                      alert((e as Error).message || 'Delete failed');
                      setItems(prev);
                    }
                  }}
                >Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
