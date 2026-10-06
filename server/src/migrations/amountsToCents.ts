import mongoose from "mongoose";
import { centsFromDecimal, centsToDecimalString } from "shared";

// One-off migration: decimal money fields (amount: 12.5) -> integer cents
// (amountCents: 1250). See docs/architecture.md "Money" for the format.
//
// Safe to run more than once: the old and new fields have different names,
// so a document is converted exactly when it still has the old field, in a
// single atomic update that sets the new field and removes the old one. A
// second run (or a run resumed after a crash) finds nothing left to convert —
// it never multiplies an already-converted value by 100 again.
//
// Before writing anything it copies every affected collection to a
// "<name>_backup_<stamp>" collection; restoreBackup() puts one back.

type RawCollection = mongoose.mongo.Collection<mongoose.mongo.BSON.Document>;

interface FieldSpec {
  from: string;
  to: string;
}

interface CollectionSpec {
  name: string;
  fields: FieldSpec[];
  // Embedded arrays whose items carry money (Loan.repayments[].amount).
  arrays?: { path: string; fields: FieldSpec[] }[];
}

export const MONEY_COLLECTIONS: CollectionSpec[] = [
  { name: "transactions", fields: [{ from: "amount", to: "amountCents" }] },
  { name: "budgets", fields: [{ from: "limit", to: "limitCents" }] },
  { name: "recurringtransactions", fields: [{ from: "amount", to: "amountCents" }] },
  {
    name: "loans",
    fields: [{ from: "principal", to: "principalCents" }],
    arrays: [{ path: "repayments", fields: [{ from: "amount", to: "amountCents" }] }],
  },
];

export interface MigrationOptions {
  dryRun?: boolean;
  // Legacy values with more than 2 decimals (e.g. 10.005) can't convert
  // without rounding. They're listed and the migration stops unless this is
  // set, so nobody's balance changes by a fraction of a cent silently.
  acceptRounding?: boolean;
  backupStamp?: string;
  log?: (line: string) => void;
}

export interface CollectionReport {
  collection: string;
  legacyDocs: number;
  convertedDocs: number;
  backup?: string;
  // Per field path: legacy total (as written, rounded to cents) vs the
  // stored cents total after conversion.
  totals: { field: string; before: string; after: string; match: boolean }[];
  roundedValues: { id: string; field: string; value: number; cents: number }[];
}

export interface MigrationReport {
  dryRun: boolean;
  collections: CollectionReport[];
  ok: boolean;
}

function legacyFilter(spec: CollectionSpec): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = spec.fields.map((f) => ({ [f.from]: { $exists: true } }));
  for (const arr of spec.arrays ?? []) {
    for (const f of arr.fields) clauses.push({ [`${arr.path}.${f.from}`]: { $exists: true } });
  }
  return { $or: clauses };
}

// Integer-exact sum of a list of legacy decimals: each is first converted to
// cents, so summing never accumulates float error.
function toCentsChecked(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${where}: not a valid amount (${JSON.stringify(value)}) — fix or remove this document, then re-run`);
  }
  return centsFromDecimal(value);
}

function hasSubCentPrecision(value: number, cents: number): boolean {
  return Math.abs(value * 100 - cents) > 1e-6;
}

function defaultStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "_");
}

async function backupCollection(coll: RawCollection, backupName: string): Promise<void> {
  const db = mongoose.connection.db!;
  const existing = await db.listCollections({ name: backupName }).toArray();
  if (existing.length > 0) {
    throw new Error(`Backup collection ${backupName} already exists — pass a different backupStamp`);
  }
  await coll.aggregate([{ $match: {} }, { $out: backupName }]).toArray();
  const [source, copy] = await Promise.all([coll.countDocuments(), db.collection(backupName).countDocuments()]);
  if (source !== copy) {
    throw new Error(`Backup of ${coll.collectionName} is incomplete (${copy} of ${source} documents) — nothing was changed`);
  }
}

// Sums of the new fields, over the documents converted in this run.
async function sumConverted(coll: RawCollection, spec: CollectionSpec, ids: unknown[]): Promise<Map<string, number>> {
  const sums = new Map<string, number>();
  const docs = await coll.find({ _id: { $in: ids } } as never).toArray();
  for (const doc of docs) {
    for (const f of spec.fields) {
      sums.set(f.to, (sums.get(f.to) ?? 0) + (Number(doc[f.to]) || 0));
    }
    for (const arr of spec.arrays ?? []) {
      for (const item of (doc[arr.path] as Record<string, unknown>[] | undefined) ?? []) {
        for (const f of arr.fields) {
          const key = `${arr.path}.${f.to}`;
          sums.set(key, (sums.get(key) ?? 0) + (Number(item[f.to]) || 0));
        }
      }
    }
  }
  return sums;
}

async function migrateCollection(spec: CollectionSpec, options: Required<MigrationOptions>): Promise<CollectionReport> {
  const db = mongoose.connection.db!;
  const coll = db.collection(spec.name);
  const report: CollectionReport = { collection: spec.name, legacyDocs: 0, convertedDocs: 0, totals: [], roundedValues: [] };

  const legacy = await coll.find(legacyFilter(spec)).toArray();
  report.legacyDocs = legacy.length;
  if (legacy.length === 0) return report;

  // Plan every update (and every expected total) before touching anything.
  const expected = new Map<string, number>();
  const add = (key: string, cents: number) => expected.set(key, (expected.get(key) ?? 0) + cents);
  const plans = legacy.map((doc) => {
    const id = String(doc._id);
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};
    const match: Record<string, unknown> = { _id: doc._id };

    for (const f of spec.fields) {
      if (doc[f.from] === undefined) continue;
      if (doc[f.to] !== undefined) {
        throw new Error(`${spec.name} ${id} has both ${f.from} and ${f.to} — resolve it by hand, then re-run`);
      }
      const value = doc[f.from] as number;
      const cents = toCentsChecked(value, `${spec.name} ${id}.${f.from}`);
      if (hasSubCentPrecision(value, cents)) report.roundedValues.push({ id, field: f.from, value, cents });
      $set[f.to] = cents;
      $unset[f.from] = "";
      match[f.from] = value; // only update if nobody changed it meanwhile
      add(f.to, cents);
    }

    for (const arr of spec.arrays ?? []) {
      const items = (doc[arr.path] as Record<string, unknown>[] | undefined) ?? [];
      if (!items.some((item) => arr.fields.some((f) => item[f.from] !== undefined))) continue;
      $set[arr.path] = items.map((item, i) => {
        const next = { ...item };
        for (const f of arr.fields) {
          if (item[f.from] === undefined) {
            if (typeof item[f.to] === "number") add(`${arr.path}.${f.to}`, item[f.to] as number);
            continue;
          }
          const value = item[f.from] as number;
          const cents = toCentsChecked(value, `${spec.name} ${id}.${arr.path}[${i}].${f.from}`);
          if (hasSubCentPrecision(value, cents)) report.roundedValues.push({ id, field: `${arr.path}[${i}].${f.from}`, value, cents });
          next[f.to] = cents;
          delete next[f.from];
          add(`${arr.path}.${f.to}`, cents);
        }
        return next;
      });
      match[arr.path] = items; // whole-array match: skip if edited meanwhile
    }

    return { id: doc._id, match, update: Object.keys($unset).length ? { $set, $unset } : { $set } };
  });

  // "Before" totals: what the old decimal data adds up to, rounded to cents
  // once at the end (how the old app displayed totals).
  const legacySums = new Map<string, number>();
  for (const doc of legacy) {
    for (const f of spec.fields) {
      if (typeof doc[f.from] === "number") legacySums.set(f.to, (legacySums.get(f.to) ?? 0) + (doc[f.from] as number));
    }
    for (const arr of spec.arrays ?? []) {
      for (const item of (doc[arr.path] as Record<string, unknown>[] | undefined) ?? []) {
        for (const f of arr.fields) {
          const key = `${arr.path}.${f.to}`;
          const value = typeof item[f.from] === "number" ? (item[f.from] as number) : typeof item[f.to] === "number" ? (item[f.to] as number) / 100 : 0;
          legacySums.set(key, (legacySums.get(key) ?? 0) + value);
        }
      }
    }
  }

  if (report.roundedValues.length > 0 && !options.acceptRounding) {
    for (const r of report.roundedValues) {
      options.log(`  ${spec.name} ${r.id} ${r.field}: ${r.value} has more than 2 decimals -> would become ${centsToDecimalString(r.cents)}`);
    }
    throw new Error(
      `${spec.name}: ${report.roundedValues.length} value(s) need rounding to whole cents (listed above). ` +
        "Nothing was changed. Re-run with --accept-rounding to round them half-up."
    );
  }

  if (options.dryRun) {
    report.totals = [...expected].map(([field, cents]) => ({
      field,
      before: centsToDecimalString(centsFromDecimal(legacySums.get(field) ?? 0)),
      after: centsToDecimalString(cents),
      match: centsFromDecimal(legacySums.get(field) ?? 0) === cents,
    }));
    return report;
  }

  report.backup = `${spec.name}_backup_${options.backupStamp}`;
  await backupCollection(coll, report.backup);

  const result = await coll.bulkWrite(
    plans.map((p) => ({ updateOne: { filter: p.match, update: p.update } })),
    { ordered: false }
  );
  report.convertedDocs = result.modifiedCount;

  const after = await sumConverted(
    coll,
    spec,
    plans.map((p) => p.id)
  );
  report.totals = [...expected].map(([field, cents]) => {
    const before = centsFromDecimal(legacySums.get(field) ?? 0);
    const stored = after.get(field) ?? 0;
    return {
      field,
      before: centsToDecimalString(before),
      after: centsToDecimalString(stored),
      // Stored total must equal the planned conversion exactly, and the
      // legacy total too (unless values were explicitly rounded).
      match: stored === cents && (report.roundedValues.length > 0 || before === stored),
    };
  });
  return report;
}

export async function migrateAmountsToCents(options: MigrationOptions = {}): Promise<MigrationReport> {
  const resolved: Required<MigrationOptions> = {
    dryRun: options.dryRun ?? false,
    acceptRounding: options.acceptRounding ?? false,
    backupStamp: options.backupStamp ?? defaultStamp(),
    log: options.log ?? (() => {}),
  };

  // Validate and plan every collection up front (dry run) so a bad document
  // in the last collection stops the run before the first one is touched.
  if (!resolved.dryRun) {
    await migrateAmountsToCents({ ...resolved, dryRun: true });
  }

  const collections: CollectionReport[] = [];
  for (const spec of MONEY_COLLECTIONS) {
    collections.push(await migrateCollection(spec, resolved));
  }

  const ok =
    collections.every((c) => c.totals.every((t) => t.match)) &&
    (resolved.dryRun || collections.every((c) => c.convertedDocs === c.legacyDocs));
  return { dryRun: resolved.dryRun, collections, ok };
}

// Puts the collections saved by a migration run back (replacing the current
// contents; indexes are kept).
export async function restoreBackup(stamp: string): Promise<string[]> {
  const db = mongoose.connection.db!;
  const restored: string[] = [];
  for (const spec of MONEY_COLLECTIONS) {
    const backupName = `${spec.name}_backup_${stamp}`;
    const exists = await db.listCollections({ name: backupName }).toArray();
    if (exists.length === 0) continue;
    await db.collection(backupName).aggregate([{ $match: {} }, { $out: spec.name }]).toArray();
    restored.push(spec.name);
  }
  return restored;
}
