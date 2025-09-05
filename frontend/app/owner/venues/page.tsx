import { requireRole } from "../../lib/roleGuard";
import { getJSONServer } from "../../lib/serverApi";
import Link from "next/link";
import OwnerVenuesClient from "./OwnerVenuesClient";

export default async function OwnerVenuesPage() {
  const user = await requireRole(["owner", "admin"]);
  const data = await getJSONServer<{ items: Array<any> }>("/api/venues", { requireAuth: true });
  const all = data.items || [];
  const items = all.filter((v) => v.ownerId === user.id);

  return (
    <div>
      <h2>Owner · My Venues</h2>
      <div style={{ margin: '8px 0' }}>
        <Link href="/owner/venues/new" data-testid="link-new-venue">+ Create new venue</Link>
      </div>
      <p>Mine: {items.length}</p>
      {items.length === 0 ? (
        <p data-testid="owner-empty">You have no venues yet.</p>
      ) : (
        <OwnerVenuesClient initial={items as any} />
      )}
      <div style={{ marginTop: 12 }}>
        <Link href="/owner">Back to Owner</Link>
      </div>
    </div>
  );
}
