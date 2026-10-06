// CLI for the decimal -> integer cents migration (see amountsToCents.ts).
//
//   npm run migrate:cents -- --dry-run          report only, change nothing
//   npm run migrate:cents                       back up, convert, verify
//   npm run migrate:cents -- --accept-rounding  also round values with >2 decimals
//   npm run migrate:cents -- --restore <stamp>  put a backup back
//
// In production (compiled): node dist/migrations/runAmountsToCents.js [flags]
// Stop the API first so nothing writes while the migration runs.
import mongoose from "mongoose";
import { connectDb } from "../config/db";
import { migrateAmountsToCents, restoreBackup } from "./amountsToCents";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const restoreIndex = args.indexOf("--restore");
  await connectDb();

  try {
    if (restoreIndex !== -1) {
      const stamp = args[restoreIndex + 1];
      if (!stamp) {
        console.error("Usage: --restore <stamp>   (the suffix of the *_backup_<stamp> collections)");
        return 1;
      }
      const restored = await restoreBackup(stamp);
      console.log(restored.length ? `Restored: ${restored.join(", ")}` : `No backups found with stamp ${stamp}`);
      return restored.length ? 0 : 1;
    }

    const report = await migrateAmountsToCents({
      dryRun: args.includes("--dry-run"),
      acceptRounding: args.includes("--accept-rounding"),
      log: (line) => console.log(line),
    });

    console.log(report.dryRun ? "\nDry run — nothing was changed.\n" : "\nMigration finished.\n");
    for (const c of report.collections) {
      const done = report.dryRun ? `${c.legacyDocs} to convert` : `${c.convertedDocs}/${c.legacyDocs} converted`;
      console.log(`${c.collection}: ${done}${c.backup ? ` (backup: ${c.backup})` : ""}`);
      for (const t of c.totals) {
        console.log(`  ${t.field.padEnd(24)} before ${t.before.padStart(14)}  after ${t.after.padStart(14)}  ${t.match ? "OK" : "MISMATCH"}`);
      }
      if (c.roundedValues.length) console.log(`  ${c.roundedValues.length} value(s) rounded to whole cents`);
    }

    const total = report.collections.reduce((n, c) => n + c.legacyDocs, 0);
    if (total === 0) {
      console.log("\nNothing to migrate: all amounts are already stored as cents.");
    }
    if (!report.ok) {
      const stamp = report.collections.find((c) => c.backup)?.backup?.split("_backup_")[1];
      console.error(
        "\nVerification FAILED — totals or document counts don't match." +
          (stamp ? `\nRe-run to finish any skipped documents, or restore with: --restore ${stamp}` : "")
      );
      return 1;
    }
    return 0;
  } finally {
    await mongoose.disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(`\nMigration stopped: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
