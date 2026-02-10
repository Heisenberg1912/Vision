import mongoose from "mongoose";
import { mustGetEnv } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global.__mongooseConn ?? { conn: null, promise: null };
global.__mongooseConn = cached;

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const mongoUri = mustGetEnv("MONGODB_URI");
    cached.promise = mongoose.connect(mongoUri, {
      bufferCommands: false
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
