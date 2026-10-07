import { createHash, randomInt, timingSafeEqual } from "crypto";
import type { UserDocument } from "../models/User";

// Emailed 6-digit codes: password reset, email verification at sign-up, and
// confirming a new email address. One set of rules for all of them:
//   - only a SHA-256 hash of the code is stored;
//   - a code expires CODE_TTL_MS after it was issued;
//   - a new code can't be issued within RESEND_COOLDOWN_MS of the last one;
//   - MAX_ATTEMPTS wrong guesses burn the code (with only 10^6 possibilities,
//     the attempt cap — not the hash — is what makes guessing impractical).
// The caller loads the fields (they're select: false), saves the user and
// sends the email.

export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

export type CodeSlot = "reset" | "email";

const FIELDS = {
  reset: { hash: "resetCodeHash", expires: "resetCodeExpiresAt", attempts: "resetCodeAttempts" },
  email: { hash: "emailCodeHash", expires: "emailCodeExpiresAt", attempts: "emailCodeAttempts" },
} as const;

// For .select(): the hidden fields a slot needs.
export function codeFields(slot: CodeSlot): string {
  const f = FIELDS[slot];
  return `+${f.hash} +${f.expires} +${f.attempts}${slot === "email" ? " +emailCodePurpose" : ""}`;
}

type CodeHolder = UserDocument & Record<string, unknown>;

function hash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function codeIssuedRecently(user: UserDocument, slot: CodeSlot, now = Date.now()): boolean {
  const expires = (user as CodeHolder)[FIELDS[slot].expires] as Date | undefined;
  if (!expires) return false;
  const issuedAt = expires.getTime() - CODE_TTL_MS;
  return now - issuedAt < RESEND_COOLDOWN_MS;
}

// Sets a fresh code on the user and returns it (to email). Doesn't save.
export function issueCode(user: UserDocument, slot: CodeSlot, now = Date.now()): string {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const holder = user as CodeHolder;
  const f = FIELDS[slot];
  holder.set(f.hash, hash(code));
  holder.set(f.expires, new Date(now + CODE_TTL_MS));
  holder.set(f.attempts, 0);
  return code;
}

export function clearCode(user: UserDocument, slot: CodeSlot): void {
  const holder = user as CodeHolder;
  const f = FIELDS[slot];
  holder.set(f.hash, undefined);
  holder.set(f.expires, undefined);
  holder.set(f.attempts, 0);
  if (slot === "email") holder.set("emailCodePurpose", undefined);
}

// True if `code` matches a live code. A wrong guess counts an attempt (and
// burns the code at MAX_ATTEMPTS). Doesn't save, and doesn't clear a correct
// code — the caller does that once the action succeeds.
export function checkCode(user: UserDocument, slot: CodeSlot, code: string, now = Date.now()): boolean {
  const holder = user as CodeHolder;
  const f = FIELDS[slot];
  const stored = holder.get(f.hash) as string | undefined;
  const expires = holder.get(f.expires) as Date | undefined;
  if (!stored || !expires || expires.getTime() < now) return false;

  if (timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(hash(code), "hex"))) return true;

  const attempts = ((holder.get(f.attempts) as number | undefined) ?? 0) + 1;
  holder.set(f.attempts, attempts);
  if (attempts >= MAX_ATTEMPTS) clearCode(user, slot);
  return false;
}
