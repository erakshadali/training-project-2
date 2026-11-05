import { destroySession, json } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return json({ ok: true });
}
