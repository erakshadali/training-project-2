import { connectDb } from "@/lib/db";
import { fail, getSessionUser, type SessionUser } from "@/lib/auth";

/** Use at the top of every admin route: `const g = await requireAdmin(); if ("error" in g) return g.error;` */
export async function requireAdmin(): Promise<{ user: SessionUser } | { error: Response }> {
  const user = await getSessionUser();
  if (!user) return { error: fail("Please log in.", 401) };
  if (user.role !== "admin") return { error: fail("Admins only.", 403) };
  await connectDb();
  return { user };
}

export function zodFields(issues: { path: PropertyKey[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const i of issues) fields[String(i.path[0])] ??= i.message;
  return fields;
}
