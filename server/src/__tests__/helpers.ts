import type { Express } from "express";
import request from "supertest";
import { vi } from "vitest";
import { sendMail } from "../utils/mailer";

// Shared test helpers. sendMail is mocked for every test (setup.ts).

export interface SignedUp {
  token: string;
  auth: { Authorization: string };
  userId: string;
}

// Sign-up no longer starts a session (it answers the same for new and
// existing emails), so tests sign up and then log in — unverified accounts
// can log in.
export async function signUpAndLogin(app: Express, email: string, password = "password123", name = "Test User"): Promise<SignedUp> {
  const signup = await request(app).post("/api/auth/signup").send({ email, password, name });
  if (signup.status !== 202) throw new Error(`sign-up failed: ${signup.status} ${JSON.stringify(signup.body)}`);
  const login = await request(app).post("/api/auth/login").send({ email, password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  const token = login.body.accessToken as string;
  return { token, auth: { Authorization: `Bearer ${token}` }, userId: login.body.user.id as string };
}

export function sentMail(): { to: string; subject: string; text: string }[] {
  return vi.mocked(sendMail).mock.calls.map(([message]) => message);
}

export function lastMailTo(address: string): { to: string; subject: string; text: string } | undefined {
  return sentMail()
    .filter((m) => m.to === address)
    .at(-1);
}

// The 6-digit code from the latest email to `address` (verification,
// email change or password reset — they all end "is: 123456").
export function lastCodeSentTo(address: string): string {
  const match = /is: (\d{6})/.exec(lastMailTo(address)?.text ?? "");
  if (!match) throw new Error(`No code was emailed to ${address}`);
  return match[1];
}

export function clearMail(): void {
  vi.mocked(sendMail).mockClear();
}
