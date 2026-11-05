import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { serializeClaim } from "@/lib/claims";
import { ClaimModel } from "@/models";

/** The signed in customer's own damage claims. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  await connectDb();
  const list = await ClaimModel.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
  return json({ claims: list.map((c) => serializeClaim(c as never)) });
}
