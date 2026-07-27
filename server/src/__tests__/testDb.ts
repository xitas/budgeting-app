import mongoose from "mongoose";

// Tests run against the same local Docker MongoDB used for development
// (`npm run mongo:up`), but on a dedicated database so they never touch
// interactive dev data. Swapping in mongodb-memory-server was tried first,
// but its binary download proved too slow/impractical in this environment —
// reusing the always-running dev container is simpler and effectively free.
const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI ?? "mongodb://root:changeme@localhost:27017/budget-app-test?authSource=admin";

export async function startTestDb(): Promise<void> {
  await mongoose.connect(TEST_MONGO_URI);
}

export async function stopTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}
