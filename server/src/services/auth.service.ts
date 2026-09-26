import { createHash, randomInt, timingSafeEqual } from "crypto";
import { Response } from "express";
import { env } from "../config/env";
import { User, UserDocument } from "../models/User";
import { AppError } from "../utils/AppError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { sendMail } from "../utils/mailer";
import { seedDefaultCategories } from "./category.service";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESET_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;

interface AuthResult {
  user: UserDocument;
  accessToken: string;
  refreshToken: string;
}

function issueTokens(user: UserDocument): { accessToken: string; refreshToken: string } {
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

export async function signup(email: string, password: string, name: string): Promise<AuthResult> {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError(409, "An account with this email already exists");
  }

  const user = new User({ email, name });
  (user as unknown as { password: string }).password = password;
  await user.save();
  await seedDefaultCategories(user.id);

  return { user, ...issueTokens(user) };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  return { user, ...issueTokens(user) };
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

function hashResetCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Always resolves the same way whether or not the email is registered, so
// the endpoint can't be used to discover which emails have accounts.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+resetCodeExpiresAt");
  if (!user) {
    return;
  }

  // Throttle resends: a code issued within the last minute is still in flight.
  const issuedAt = user.resetCodeExpiresAt ? user.resetCodeExpiresAt.getTime() - RESET_CODE_TTL_MS : 0;
  if (Date.now() - issuedAt < RESET_CODE_RESEND_COOLDOWN_MS) {
    return;
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  user.resetCodeHash = hashResetCode(code);
  user.resetCodeExpiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);
  user.resetCodeAttempts = 0;
  await user.save();

  await sendMail({
    to: user.email,
    subject: "Your password reset code",
    text:
      `Hi ${user.name},\n\n` +
      `Your password reset code is: ${code}\n\n` +
      `It expires in ${RESET_CODE_TTL_MS / 60_000} minutes. If you didn't ask to reset your password, ignore this email.`,
  });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const invalid = new AppError(400, "Invalid or expired code");
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+resetCodeHash +resetCodeExpiresAt +resetCodeAttempts"
  );
  if (!user?.resetCodeHash || !user.resetCodeExpiresAt || user.resetCodeExpiresAt.getTime() < Date.now()) {
    throw invalid;
  }

  const expected = Buffer.from(user.resetCodeHash, "hex");
  const actual = Buffer.from(hashResetCode(code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    user.resetCodeAttempts += 1;
    // Out of attempts burns the code — with only 10^6 possibilities, the
    // attempt cap (not the hash) is what makes guessing impractical.
    if (user.resetCodeAttempts >= RESET_CODE_MAX_ATTEMPTS) {
      clearResetCode(user);
    }
    await user.save();
    throw invalid;
  }

  clearResetCode(user);
  (user as unknown as { password: string }).password = newPassword;
  // Log out every device: whoever knew the old password shouldn't keep a session.
  user.refreshTokenVersion += 1;
  await user.save();
}

function clearResetCode(user: UserDocument): void {
  user.resetCodeHash = undefined;
  user.resetCodeExpiresAt = undefined;
  user.resetCodeAttempts = 0;
}

export async function getUserById(userId: string | undefined): Promise<UserDocument | null> {
  if (!userId) {
    return null;
  }
  return User.findById(userId);
}
