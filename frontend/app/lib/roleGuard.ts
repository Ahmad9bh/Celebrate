import { redirect } from "next/navigation";
import { getJSONServer } from "./serverApi";

export type Role = "user" | "owner" | "admin";

export async function requireRole(allowed: Role[]) {
  const { user } = await getJSONServer<{ user: { role: Role; name?: string } }>(
    "/api/auth/me",
    { requireAuth: true }
  );
  if (!user || !allowed.includes(user.role)) {
    return redirect("/");
  }
  return user;
}
