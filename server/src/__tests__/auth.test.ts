import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { User } from "../models/User";
import { clearMail, lastCodeSentTo, lastMailTo, sentMail } from "./helpers";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

const app = createApp();
const credentials = { email: "test@example.com", password: "password123", name: "Test User" };

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  clearMail();
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

const signup = (body = credentials, mobile = false) => {
  const req = request(app).post("/api/auth/signup");
  if (mobile) req.set("X-Client-Type", "mobile");
  return req.send(body);
};
const login = (mobile = false) => {
  const req = request(app).post("/api/auth/login");
  if (mobile) req.set("X-Client-Type", "mobile");
  return req.send({ email: credentials.email, password: credentials.password });
};

describe("sign-up and email verification", () => {
  it("creates an unverified account, emails a code, and starts no session", async () => {
    const res = await signup();
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ message: expect.stringMatching(/Check your email/) });
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeUndefined();

    const user = await User.findOne({ email: credentials.email });
    expect(user!.emailVerified).toBe(false);
    expect(lastMailTo(credentials.email)!.subject).toBe("Your verification code");
  });

  it("answers an already-registered email exactly the same, and tells the owner instead", async () => {
    const first = await signup();
    clearMail();
    const again = await signup({ ...credentials, password: "someone-elses-password", name: "Someone" });

    expect(again.status).toBe(first.status);
    expect(again.body).toEqual(first.body);
    expect(await User.countDocuments({ email: credentials.email })).toBe(1);
    expect(lastMailTo(credentials.email)!.subject).toBe("Someone tried to sign up with your email");
    expect(lastMailTo(credentials.email)!.text).not.toMatch(/\d{6}/); // no code in the heads-up
  });

  it("sends the 'already registered' heads-up at most once an hour", async () => {
    await signup();
    clearMail();
    await signup();
    await signup();
    expect(sentMail()).toHaveLength(1);
  });

  it("verifies with the emailed code and signs in", async () => {
    await signup();
    const code = lastCodeSentTo(credentials.email);

    const res = await request(app).post("/api/auth/verify-email").send({ email: credentials.email, code });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: credentials.email, emailVerified: true, currency: "PKR" });
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.headers["set-cookie"]).toBeDefined();

    const reuse = await request(app).post("/api/auth/verify-email").send({ email: credentials.email, code });
    expect(reuse.status).toBe(400);
  });

  it("rejects a wrong code, burns it after 5 tries, and treats unknown emails the same", async () => {
    await signup();
    const code = lastCodeSentTo(credentials.email);
    const wrong = code === "000000" ? "111111" : "000000";

    const unknown = await request(app).post("/api/auth/verify-email").send({ email: "nobody@example.com", code: wrong });
    const bad = await request(app).post("/api/auth/verify-email").send({ email: credentials.email, code: wrong });
    expect(unknown.status).toBe(400);
    expect(bad.body).toEqual(unknown.body);

    for (let i = 0; i < 4; i++) await request(app).post("/api/auth/verify-email").send({ email: credentials.email, code: wrong });
    const afterBurn = await request(app).post("/api/auth/verify-email").send({ email: credentials.email, code });
    expect(afterBurn.status).toBe(400);
  });

  it("lets unverified users log in, and resends codes with a cooldown", async () => {
    await signup();
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(false);

    clearMail();
    const resend = await request(app).post("/api/auth/verify-email/resend").send({ email: credentials.email });
    expect(resend.status).toBe(200);
    expect(sentMail()).toHaveLength(0); // the sign-up code is under a minute old

    await User.updateOne({ email: credentials.email }, { emailCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000) }); // issued 5 min ago
    await request(app).post("/api/auth/verify-email/resend").send({ email: credentials.email });
    const code = lastCodeSentTo(credentials.email);
    const verified = await request(app).post("/api/auth/verify-email").send({ email: credentials.email, code });
    expect(verified.body.user.emailVerified).toBe(true);
  });

  it("resend answers the same for unknown and already-verified emails, and sends nothing", async () => {
    await signup();
    await request(app).post("/api/auth/verify-email").send({ email: credentials.email, code: lastCodeSentTo(credentials.email) });
    clearMail();
    const verified = await request(app).post("/api/auth/verify-email/resend").send({ email: credentials.email });
    const unknown = await request(app).post("/api/auth/verify-email/resend").send({ email: "nobody@example.com" });
    expect(verified.status).toBe(unknown.status);
    expect(verified.body).toEqual(unknown.body);
    expect(sentMail()).toHaveLength(0);
  });

  it("treats accounts from before verification existed as verified", async () => {
    await signup();
    await User.updateOne({ email: credentials.email }, { $unset: { emailVerified: "" } });
    const res = await login();
    expect(res.body.user.emailVerified).toBe(true);
  });

  it("seeds 8 default categories and never returns secrets", async () => {
    await signup();
    const res = await login();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.emailCodeHash).toBeUndefined();
    const categoriesRes = await request(app).get("/api/categories").set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(categoriesRes.status).toBe(200);
    expect(categoriesRes.body.categories).toHaveLength(8);
  });
});

describe("auth flow", () => {
  it("logs in with correct credentials and rejects a wrong password", async () => {
    await signup();
    expect((await login()).status).toBe(200);
    const badLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: "wrong-password" });
    expect(badLogin.status).toBe(401);
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("logout invalidates the existing refresh cookie", async () => {
    await signup();
    const refreshCookie = (await login()).headers["set-cookie"];

    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
    expect(refreshRes.status).toBe(200);
    const rotatedCookie = refreshRes.headers["set-cookie"];

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", rotatedCookie)
      .set("Authorization", `Bearer ${refreshRes.body.accessToken}`);
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await request(app).post("/api/auth/refresh").set("Cookie", rotatedCookie);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("never exposes the refresh token in the body to web clients", async () => {
    await signup();
    const res = await login();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });
});

describe("mobile auth flow (X-Client-Type: mobile)", () => {
  it("returns the refresh token in the body instead of a cookie", async () => {
    await signup(credentials, true);
    const res = await login(true);
    expect(res.status).toBe(200);
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("verifying from the mobile app also returns the refresh token in the body", async () => {
    await signup(credentials, true);
    const res = await request(app)
      .post("/api/auth/verify-email")
      .set("X-Client-Type", "mobile")
      .send({ email: credentials.email, code: lastCodeSentTo(credentials.email) });
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("refreshes with a body token, and logout invalidates it", async () => {
    await signup();
    const loginRes = await login(true);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("X-Client-Type", "mobile")
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.refreshToken).toBe("string");

    await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${refreshRes.body.accessToken}`);

    const refreshAfterLogout = await request(app)
      .post("/api/auth/refresh")
      .set("X-Client-Type", "mobile")
      .send({ refreshToken: refreshRes.body.refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("rejects a mobile refresh with no token", async () => {
    const res = await request(app).post("/api/auth/refresh").set("X-Client-Type", "mobile").send({});
    expect(res.status).toBe(401);
  });
});
