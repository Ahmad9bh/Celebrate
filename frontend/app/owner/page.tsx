import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "../lib/roleGuard";

export default async function OwnerHome() {
  const user = await requireRole(["owner", "admin"]);

  return (
    <div>
      <h2>Owners area</h2>
      <p>Welcome, {user?.name}. Manage your venues and bookings (placeholder page).</p>
      <ul>
        <li><Link href="/owner/venues">My venues (coming soon)</Link></li>
        <li><Link href="/owner/bookings">Bookings (coming soon)</Link></li>
      </ul>
    </div>
  );
}
