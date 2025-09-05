import { redirect } from "next/navigation";
import { getJSONServer } from "./serverApi";

export type Role = "user" | "owner" | "admin";

type MeResponse = { user: { id: string; role: Role; name?: string } };

export async function requireRole(allowed: Role[]) {
  const { user } = await getJSONServer<MeResponse>(
    "/api/auth/me",
    { requireAuth: true }
  );
  if (!user || !allowed.includes(user.role)) {
    return redirect("/");
  }
  return user;
}
