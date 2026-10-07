import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { User } from "../models/User";
import { sendMail } from "../utils/mailer";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

vi.mock("../utils/mailer", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

const app = createApp();
const credentials = { email: "reset@example.com", password: "password123", name: "Reset User" };
const newPassword = "brand-new-password";

function lastSentCode(): string {
  const text = vi.mocked(sendMail).mock.lastCall?.[0].text ?? "";
  const match = /code is: (\d{6})/.exec(text);
  if (!match) {
    throw new Error("No reset code was emailed");
  }
  return match[1];
}

async function requestCode(): Promise<string> {
  const res = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
  expect(res.status).toBe(200);
  return lastSentCode();
}

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  vi.mocked(sendMail).mockClear();
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe("password reset", () => {
  it("responds identically for an unknown email and sends nothing", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    vi.mocked(sendMail).mockClear(); // drop the sign-up verification email

    const known = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("stores only a hash of the code, never the code itself", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const code = await requestCode();

    const user = await User.findOne({ email: credentials.email }).select("+resetCodeHash");
    expect(user?.resetCodeHash).toBeDefined();
    expect(user?.resetCodeHash).not.toContain(code);
  });

  it("resets the password with a valid code, logs out other sessions, and burns the code", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const loginRes = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    const oldRefreshCookie = loginRes.headers["set-cookie"];
    const code = await requestCode();

    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: credentials.email, code, newPassword });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: newPassword });
    expect(newLogin.status).toBe(200);

    const refreshWithOldSession = await request(app).post("/api/auth/refresh").set("Cookie", oldRefreshCookie);
    expect(refreshWithOldSession.status).toBe(401);

    const reuse = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: credentials.email, code, newPassword: "another-password" });
    expect(reuse.status).toBe(400);
  });

  it("rejects an expired code", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const code = await requestCode();
    await User.updateOne({ email: credentials.email }, { resetCodeExpiresAt: new Date(Date.now() - 1000) });

    const res = await request(app).post("/api/auth/reset-password").send({ email: credentials.email, code, newPassword });
    expect(res.status).toBe(400);
  });

  it("burns the code after 5 wrong attempts, even if the right code comes next", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const code = await requestCode();
    const wrongCode = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ email: credentials.email, code: wrongCode, newPassword });
      expect(res.status).toBe(400);
    }

    const res = await request(app).post("/api/auth/reset-password").send({ email: credentials.email, code, newPassword });
    expect(res.status).toBe(400);
  });

  it("does not send a second code within the resend cooldown", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    vi.mocked(sendMail).mockClear();
    await requestCode();
    await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("marks the email verified, since the code arrived by email", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    expect((await User.findOne({ email: credentials.email }))!.emailVerified).toBe(false);
    const code = await requestCode();
    await request(app).post("/api/auth/reset-password").send({ email: credentials.email, code, newPassword });
    expect((await User.findOne({ email: credentials.email }))!.emailVerified).toBe(true);
  });

  it("validates the code format and new password length", async () => {
    const badCode = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: credentials.email, code: "12ab56", newPassword });
    expect(badCode.status).toBe(400);

    const shortPassword = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: credentials.email, code: "123456", newPassword: "short" });
    expect(shortPassword.status).toBe(400);
  });
});
