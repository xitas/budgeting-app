import { createApp } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";

async function main(): Promise<void> {
  await connectDb();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
