import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { createSession, fail, json, throttled } from "@/lib/auth";
import { UserModel } from "@/models";

const schema = z.object({ email: z.email().max(120), password: z.string().min(1).max(72) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Enter your email and password.", 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const email = parsed.data.email.toLowerCase();
  // Limits per account (whoever is guessing) and per address, so spreading guesses over many IPs or many emails both get slowed.
  const FIFTEEN_MIN = 15 * 60_000;
  if (throttled(`login-email:${email}`, 10, FIFTEEN_MIN) || throttled(`login-ip:${ip}`, 40, FIFTEEN_MIN)) {
    return fail("Too many attempts. Please wait a few minutes and try again.", 429);
  }

  await connectDb();
  const user = await UserModel.findOne({ email });
  // Same message for unknown email and wrong password so accounts cannot be probed.
  const ok = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return fail("Incorrect email or password.", 401);
  if (user.disabled) return fail("This account has been suspended. Please contact support.", 403);

  await createSession(String(user._id));
  return json({ user: { id: String(user._id), name: user.name, email: user.email, phone: user.phone ?? "", role: user.role } });
}
