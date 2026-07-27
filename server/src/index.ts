import { createApp } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";
import { startRecurringJob } from "./jobs/recurringJob";

async function main(): Promise<void> {
  await connectDb();
  startRecurringJob();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
