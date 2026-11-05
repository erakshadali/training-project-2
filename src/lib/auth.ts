import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/models";

export const SESSION_COOKIE = "rentease_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export type SessionUser = { id: string; name: string; email: string; phone: string; role: "user" | "admin" };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set (at least 16 characters) in production.");
  }
  // Development only. Never used when NODE_ENV is production.
  return new TextEncoder().encode("rentease-dev-only-secret-change-me");
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Reads the signed session cookie and returns the logged in user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    await connectDb();
    const u = await UserModel.findById(payload.sub).lean();
    if (!u || u.disabled) return null;
    return { id: String(u._id), name: u.name, email: u.email, phone: u.phone ?? "", role: u.role };
  } catch {
    return null;
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(error: string, status = 400, fields?: Record<string, string>) {
  return Response.json({ error, fields }, { status });
}

/** Very small in-memory throttle for login and register attempts (per server instance). */
const hits = new Map<string, { n: number; reset: number }>();
export function throttled(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  h.n += 1;
  return h.n > limit;
}
