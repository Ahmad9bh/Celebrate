import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "../lib/roleGuard";

export default async function AdminHome() {
  const user = await requireRole(["admin"]);

  return (
    <div>
      <h2>Admin</h2>
      <p>Welcome, {user?.name}. Admin tools (placeholder page).</p>
      <ul>
        <li><Link href="/admin/venues">All venues (coming soon)</Link></li>
        <li><Link href="/admin/users">All users (coming soon)</Link></li>
      </ul>
    </div>
  );
}
