import { requireRole } from "../../../../lib/roleGuard";
import { getJSONServer } from "../../../../lib/serverApi";
import OwnerVenueEditForm from "../../OwnerVenueEditForm";
import Link from "next/link";

type Venue = {
  id: string;
  name: string;
  description?: string | null;
  city: string;
  country: string;
  capacity: number;
  basePrice: number;
  ownerId: string;
};

export default async function EditOwnerVenuePage({ params }: { params: { id: string } }) {
  const user = await requireRole(["owner", "admin"]);
  const v = await getJSONServer<Venue>(`/api/venues/${params.id}`, { requireAuth: true });
  // Enforce ownership client-side too (backend also enforces on PUT)
  if (user.role !== "admin" && v.ownerId !== user.id) {
    // Simple guard: link back
    return (
      <div>
        <h2>Owner · Edit Venue</h2>
        <p>You do not have access to this venue.</p>
        <Link href="/owner/venues">Back to My Venues</Link>
      </div>
    );
  }
  return (
    <div>
      <h2>Owner · Edit Venue</h2>
      <OwnerVenueEditForm initial={v} />
      <div style={{ marginTop: 12 }}>
        <Link href="/owner/venues">Back to My Venues</Link>
      </div>
    </div>
  );
}
