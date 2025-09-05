import { requireRole } from "../../lib/roleGuard";
import { getJSONServer } from "../../lib/serverApi";
import Link from "next/link";
import AdminVenuesClient from "./AdminVenuesClient";

export default async function AdminVenuesPage() {
  await requireRole(["admin"]);
  const data = await getJSONServer<{ items: Array<any> }>("/api/admin/venues", { requireAuth: true });
  const items = data.items || [];

  return (
    <div>
      <h2>Admin · Venues</h2>
      <p>Total: {items.length}</p>
      {items.length === 0 ? (
        <p>No venues yet.</p>
      ) : (
        <AdminVenuesClient initial={items as any} />
      )}
      <div style={{ marginTop: 12 }}>
        <Link href="/admin">Back to Admin</Link>
      </div>
    </div>
  );
}
