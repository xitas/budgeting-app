import { Response } from "express";
import { env } from "../config/env";
import { User, UserDocument } from "../models/User";
import { AppError } from "../utils/AppError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { seedDefaultCategories } from "./category.service";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

export async function getUserById(userId: string | undefined): Promise<UserDocument | null> {
  if (!userId) {
    return null;
  }
  return User.findById(userId);
}
