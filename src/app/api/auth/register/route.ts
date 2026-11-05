import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { createSession, fail, json, throttled } from "@/lib/auth";
import { UserModel } from "@/models";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.email("Enter a valid email").max(120),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10 digit Indian mobile number"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (throttled(`register:${ip}`, 8)) return fail("Too many attempts. Please wait a minute.", 429);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return fail("Please fix the highlighted fields.", 400, fields);
  }

  await connectDb();
  const email = parsed.data.email.toLowerCase();
  if (await UserModel.exists({ email })) return fail("An account with this email already exists.", 409, { email: "Already registered. Try logging in." });

  const user = await UserModel.create({
    name: parsed.data.name,
    email,
    phone: parsed.data.phone,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
  });
  await createSession(String(user._id));
  return json({ user: { id: String(user._id), name: user.name, email: user.email, phone: user.phone, role: user.role } }, 201);
}
