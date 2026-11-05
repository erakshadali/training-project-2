import mongoose from "mongoose";

/**
 * MongoDB connection, cached across hot reloads and serverless invocations.
 *
 * - Production and normal use: set MONGODB_URI (for example a MongoDB Atlas connection string).
 * - Local development with no MONGODB_URI: a temporary in-memory MongoDB is started so the
 *   app runs with zero setup. Its data is wiped every time the dev server restarts.
 */
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; seeded: boolean; memory?: { getUri(): string } };

const g = globalThis as unknown as { __rentease?: Cache };
const cache: Cache = (g.__rentease ??= { conn: null, promise: null, seeded: false });

async function resolveUri(): Promise<string> {
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) return uri;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is not set. Add it to your environment before starting in production.");
  }
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const server = await MongoMemoryServer.create({ instance: { dbName: "rentease" } });
  cache.memory = server;
  console.warn("[rentease] MONGODB_URI not set: using a temporary in-memory MongoDB (data resets on restart).");
  return server.getUri();
}

export async function connectDb() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = resolveUri().then((uri) =>
      mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "rentease", bufferCommands: false, serverSelectionTimeoutMS: 15000 }),
    );
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  if (!cache.seeded) {
    cache.seeded = true;
    const { seedIfEmpty } = await import("@/lib/seed");
    await seedIfEmpty();
  }
  return cache.conn;
}
