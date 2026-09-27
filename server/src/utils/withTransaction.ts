import mongoose, { ClientSession } from "mongoose";

// Runs fn inside a MongoDB multi-document transaction: every write passed
// the session commits together or not at all. Needs a replica set (see
// docker-compose.yml).
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
