import bcrypt from "bcrypt";
import { Response } from "express";
import { env } from "../config/env";
import { SALT_ROUNDS, User, UserDocument } from "../models/User";
import { AppError } from "../utils/AppError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { sendMail } from "../utils/mailer";
import { seedDefaultCategories } from "./category.service";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "./loginThrottle.service";
import { CODE_TTL_MS, checkCode, clearCode, codeFields, codeIssuedRecently, issueCode } from "./oneTimeCode";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// At most one "someone tried to sign up with your address" email per hour.
const SIGNUP_NOTICE_INTERVAL_MS = 60 * 60 * 1000;

export interface AuthResult {
  user: UserDocument;
  accessToken: string;
  refreshToken: string;
}

export function issueTokens(user: UserDocument): { accessToken: string; refreshToken: string } {
  const accessToken = signAccessToken({ sub: user.id });
  const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.refreshTokenVersion });
  return { accessToken, refreshToken };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function codeMinutes(): number {
  return CODE_TTL_MS / 60_000;
}

export async function sendVerificationCode(user: UserDocument, code: string): Promise<void> {
  await sendMail({
    to: user.email,
    subject: "Your verification code",
    text:
      `Hi ${user.name},\n\n` +
      `Your verification code is: ${code}\n\n` +
      `Enter it in the app to confirm this is your email address. It expires in ${codeMinutes()} minutes.\n\n` +
      "If you didn't create a Budget App account, ignore this email.",
  });
}

// Sign-up answers identically whether or not the email is registered, so it
// can't be used to find out who has an account: a new address gets a
// verification code; an existing one gets a heads-up instead (at most hourly).
// Either way no session starts here — the code (POST /verify-email) signs a
// new user in, and anyone can log in with their password as usual.
export async function signup(email: string, password: string, name: string): Promise<void> {
  const existing = await User.findOne({ email: email.toLowerCase() }).select("+signupNoticeSentAt");
  if (existing) {
    // Same bcrypt work as creating an account, so timing doesn't tell either.
    await bcrypt.hash(password, SALT_ROUNDS);
    if (!existing.signupNoticeSentAt || Date.now() - existing.signupNoticeSentAt.getTime() > SIGNUP_NOTICE_INTERVAL_MS) {
      existing.signupNoticeSentAt = new Date();
      await existing.save();
      await sendMail({
        to: existing.email,
        subject: "Someone tried to sign up with your email",
        text:
          `Hi ${existing.name},\n\n` +
          "Someone just tried to create a Budget App account with this email address, but you already have one.\n\n" +
          "If it was you, log in instead — or use \"Forgot password?\" on the login screen if you don't remember your password.\n" +
          "If it wasn't you, you can ignore this email; nothing has changed.",
      });
    }
    return;
  }

  const user = new User({ email, name, emailVerified: false });
  (user as unknown as { password: string }).password = password;
  const code = issueCode(user, "email");
  user.emailCodePurpose = "verify";
  try {
    await user.save();
  } catch (err) {
    // Two sign-ups for the same new address at once: the loser behaves like
    // "already registered" (the unique index decided).
    if ((err as { code?: number }).code === 11000) return;
    throw err;
  }
  await seedDefaultCategories(user.id);
  await sendVerificationCode(user, code);
}

// Confirms the address with the code from the sign-up email and signs in —
// the code proves control of the mailbox, as a password reset does.
export async function verifyEmail(email: string, code: string): Promise<AuthResult> {
  const invalid = new AppError(400, "Invalid or expired code");
  const user = await User.findOne({ email: email.toLowerCase() }).select(codeFields("email"));
  if (!user || user.emailCodePurpose !== "verify") throw invalid;
  if (!checkCode(user, "email", code)) {
    await user.save(); // persists the attempt count
    throw invalid;
  }
  clearCode(user, "email");
  user.emailVerified = true;
  await user.save();
  await clearLoginFailures(email);
  return { user, ...issueTokens(user) };
}

// Same response whether or not the address exists or is already verified.
export async function resendVerification(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() }).select(codeFields("email"));
  if (!user || user.emailVerified !== false || codeIssuedRecently(user, "email")) return;
  const code = issueCode(user, "email");
  user.emailCodePurpose = "verify";
  user.pendingEmail = undefined; // a fresh verification replaces any pending email change
  await user.save();
  await sendVerificationCode(user, code);
}

// Hashed once, lazily: compared against when no account matches, so a login
// for an unknown email takes as long as a wrong password for a real one and
// response timing doesn't reveal which emails have accounts.
let dummyPasswordHash: Promise<string> | undefined;
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= bcrypt.hash("no-such-account", SALT_ROUNDS);
  return dummyPasswordHash;
}

// Unknown email and wrong password get the identical 401 (and the identical
// throttling), so the response never says whether an account exists.
// Unverified accounts can log in; the apps show a "verify your email" banner.
export async function login(email: string, password: string): Promise<AuthResult> {
  await assertLoginAllowed(email);

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const valid = user ? await user.comparePassword(password) : (await bcrypt.compare(password, await getDummyPasswordHash()), false);
  if (!user || !valid) {
    await recordLoginFailure(email);
    throw new AppError(401, "Invalid email or password");
  }

  await clearLoginFailures(email);
  return { user, ...issueTokens(user) };
}

// For account actions that re-ask the password (change password/email,
// delete account): same per-account throttling as login, so a stolen access
// token can't be used to brute-force the password.
export async function assertPassword(user: UserDocument, password: string, message = "Password is incorrect"): Promise<void> {
  await assertLoginAllowed(user.email);
  const withHash = await User.findById(user._id).select("+passwordHash");
  if (!withHash || !(await withHash.comparePassword(password))) {
    await recordLoginFailure(user.email);
    throw new AppError(400, message);
  }
  await clearLoginFailures(user.email);
}

export async function refresh(token: string | undefined): Promise<AuthResult> {
  if (!token) {
    throw new AppError(401, "Missing refresh token");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.refreshTokenVersion !== payload.tokenVersion) {
    throw new AppError(401, "Refresh token no longer valid");
  }

  return { user, ...issueTokens(user) };
}

export async function logout(userId: string | undefined): Promise<void> {
  if (userId) {
    // Bumping the version invalidates every outstanding refresh token for
    // this user in one step — no need to track/blacklist individual tokens.
    await User.updateOne({ _id: userId }, { $inc: { refreshTokenVersion: 1 } });
  }
}

// Always resolves the same way whether or not the email is registered, so
// the endpoint can't be used to discover which emails have accounts.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() }).select(codeFields("reset"));
  if (!user || codeIssuedRecently(user, "reset")) {
    return;
  }

  const code = issueCode(user, "reset");
  await user.save();

  await sendMail({
    to: user.email,
    subject: "Your password reset code",
    text:
      `Hi ${user.name},\n\n` +
      `Your password reset code is: ${code}\n\n` +
      `It expires in ${codeMinutes()} minutes. If you didn't ask to reset your password, ignore this email.`,
  });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const invalid = new AppError(400, "Invalid or expired code");
  const user = await User.findOne({ email: email.toLowerCase() }).select(codeFields("reset"));
  if (!user) throw invalid;
  if (!checkCode(user, "reset", code)) {
    await user.save(); // persists the attempt count (or the burned code)
    throw invalid;
  }

  clearCode(user, "reset");
  (user as unknown as { password: string }).password = newPassword;
  // The code arrived by email, so the address is proven too.
  user.emailVerified = true;
  // Log out every device: whoever knew the old password shouldn't keep a session.
  user.refreshTokenVersion += 1;
  await user.save();
  // Proven control of the mailbox: lift any failed-login cooldown.
  await clearLoginFailures(email);
}

export async function getUserById(userId: string | undefined): Promise<UserDocument | null> {
  if (!userId) {
    return null;
  }
  return User.findById(userId);
}
