import cron from "node-cron";
import { runDueForAll } from "../services/recurring.service";

// Safety net for the on-demand catch-up in transaction.service.ts: keeps
// recurring transactions generating even if no one opens the app on a given
// day. Runs once daily, shortly after midnight UTC.
export function startRecurringJob(): void {
  cron.schedule("5 0 * * *", () => {
    runDueForAll().catch((err) => {
      console.error("[recurring-job] failed to generate due transactions", err);
    });
  });
}
