// Starts a throwaway MongoDB on 127.0.0.1:27018 so you can run the production build locally
// without a MongoDB Atlas account:
//
//   node scripts/local-db.mjs                     (leave it running in one terminal)
//   MONGODB_URI=mongodb://127.0.0.1:27018 AUTH_SECRET=local-secret-change-me-123 npm run start
//
// Data lives in memory and is lost when this process stops. Not for real use.
import { MongoMemoryServer } from "mongodb-memory-server";

const server = await MongoMemoryServer.create({ instance: { port: 27018, ip: "127.0.0.1", dbName: "rentease" } });
console.log(`Temporary MongoDB ready: ${server.getUri()}`);
console.log("Press Ctrl+C to stop.");

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
