import { requireRole } from "../../../lib/roleGuard";
import OwnerVenueForm from "../OwnerVenueForm";
import Link from "next/link";

export default async function NewOwnerVenuePage() {
  await requireRole(["owner", "admin"]);
  return (
    <div>
      <h2>Owner · New Venue</h2>
      <OwnerVenueForm />
      <div style={{ marginTop: 12 }}>
        <Link href="/owner/venues">Back to My Venues</Link>
      </div>
    </div>
  );
}
