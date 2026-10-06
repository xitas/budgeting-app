import { LoginThrottle } from "../models/LoginThrottle";
import { AppError } from "../utils/AppError";

// Per-account slowdown for repeated failed logins (on top of the per-IP
// limit in middleware/rateLimit.ts, which an attacker spreading guesses over
// many IPs would get around). The first few mistakes are free; after that
// each further failure doubles the wait before the next attempt is accepted,
// capped at MAX_DELAY_MS. Nothing is ever locked for good: a successful login
// clears the record, and it expires on its own FORGET_AFTER_MS after the last
// failure.
export const FREE_FAILURES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 15 * 60 * 1000;
const FORGET_AFTER_MS = 24 * 60 * 60 * 1000;

export function delayAfterFailures(failures: number): number {
  if (failures <= FREE_FAILURES) return 0;
  return Math.min(BASE_DELAY_MS * 2 ** (failures - FREE_FAILURES - 1), MAX_DELAY_MS);
}

function throttleKey(email: string): string {
  return email.trim().toLowerCase();
}

// Throws 429 while the account is cooling down. Same response whether or not
// an account exists for the email.
export async function assertLoginAllowed(email: string, now = new Date()): Promise<void> {
  const record = await LoginThrottle.findOne({ key: throttleKey(email) }).lean();
  if (record?.nextAllowedAt && record.nextAllowedAt > now) {
    const seconds = Math.ceil((record.nextAllowedAt.getTime() - now.getTime()) / 1000);
    throw new AppError(429, `Too many failed login attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`, {
      "Retry-After": String(seconds),
    });
  }
}

export async function recordLoginFailure(email: string, now = new Date()): Promise<void> {
  const record = await LoginThrottle.findOneAndUpdate(
    { key: throttleKey(email) },
    { $inc: { failures: 1 }, $set: { expiresAt: new Date(now.getTime() + FORGET_AFTER_MS) } },
    { upsert: true, new: true }
  );
  const delay = delayAfterFailures(record.failures);
  if (delay > 0) {
    await LoginThrottle.updateOne({ _id: record._id }, { $set: { nextAllowedAt: new Date(now.getTime() + delay) } });
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  await LoginThrottle.deleteOne({ key: throttleKey(email) });
}
