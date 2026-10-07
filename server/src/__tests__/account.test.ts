import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { Budget } from "../models/Budget";
import { Category } from "../models/Category";
import { Loan } from "../models/Loan";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { clearMail, lastCodeSentTo, lastMailTo, sentMail, signUpAndLogin } from "./helpers";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

const app = createApp();

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

const loginCookie = async (email: string, password = "password123") =>
  (await request(app).post("/api/auth/login").send({ email, password })).headers["set-cookie"];

describe("profile", () => {
  it("changes the name and the display currency", async () => {
    const { auth } = await signUpAndLogin(app, "profile@example.com");
    const me = await request(app).get("/api/auth/me").set(auth);
    expect(me.body.user.currency).toBe("PKR"); // default

    const res = await request(app).patch("/api/account/profile").set(auth).send({ name: "  New Name ", currency: "USD" });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: "New Name", currency: "USD" });
    expect((await request(app).get("/api/auth/me").set(auth)).body.user.currency).toBe("USD");
  });

  it("rejects unknown currencies and empty updates", async () => {
    const { auth } = await signUpAndLogin(app, "badprofile@example.com");
    expect((await request(app).patch("/api/account/profile").set(auth).send({ currency: "JPY" })).status).toBe(400);
    expect((await request(app).patch("/api/account/profile").set(auth).send({ name: "" })).status).toBe(400);
    expect((await request(app).patch("/api/account/profile").set(auth).send({})).status).toBe(400);
  });

  it("requires sign-in", async () => {
    expect((await request(app).patch("/api/account/profile").send({ name: "x" })).status).toBe(401);
  });
});

describe("change password", () => {
  it("needs the current password, signs out other devices and keeps this one signed in", async () => {
    const email = "pw@example.com";
    const { auth } = await signUpAndLogin(app, email);
    const otherDevice = await loginCookie(email);

    const wrong = await request(app).post("/api/account/password").set(auth).send({ currentPassword: "nope-nope", newPassword: "brand-new-pass" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toBe("Current password is incorrect");

    const res = await request(app).post("/api/account/password").set(auth).send({ currentPassword: "password123", newPassword: "brand-new-pass" });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    const thisDevice = res.headers["set-cookie"];

    expect((await request(app).post("/api/auth/refresh").set("Cookie", otherDevice)).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", thisDevice)).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email, password: "brand-new-pass" })).status).toBe(200);
    expect(lastMailTo(email)!.subject).toBe("Your password was changed");
  });

  it("rejects a too-short or unchanged new password", async () => {
    const { auth } = await signUpAndLogin(app, "pw2@example.com");
    expect((await request(app).post("/api/account/password").set(auth).send({ currentPassword: "password123", newPassword: "short" })).status).toBe(400);
    expect((await request(app).post("/api/account/password").set(auth).send({ currentPassword: "password123", newPassword: "password123" })).status).toBe(400);
  });

  it("throttles repeated wrong current passwords like logins", async () => {
    const { auth } = await signUpAndLogin(app, "pw3@example.com");
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await request(app).post("/api/account/password").set(auth).send({ currentPassword: "wrong-wrong", newPassword: "brand-new-pass" })).status);
    }
    expect(statuses).toEqual([400, 400, 400, 400, 429]);
  });
});

describe("change email", () => {
  it("sends a code to the new address and switches once it's entered", async () => {
    const { auth } = await signUpAndLogin(app, "old@example.com");

    const wrongPassword = await request(app).post("/api/account/email").set(auth).send({ newEmail: "new@example.com", password: "nope-nope" });
    expect(wrongPassword.status).toBe(400);

    const req1 = await request(app).post("/api/account/email").set(auth).send({ newEmail: "New@Example.com", password: "password123" });
    expect(req1.status).toBe(200);
    expect(req1.body.user).toMatchObject({ email: "old@example.com", pendingEmail: "new@example.com" });

    const code = lastCodeSentTo("new@example.com");
    const confirm = await request(app).post("/api/account/email/confirm").set(auth).send({ code });
    expect(confirm.status).toBe(200);
    expect(confirm.body.user).toMatchObject({ email: "new@example.com", emailVerified: true });
    expect(confirm.body.user.pendingEmail).toBeUndefined();
    expect(lastMailTo("old@example.com")!.subject).toBe("Your email address was changed");

    expect((await request(app).post("/api/auth/login").send({ email: "new@example.com", password: "password123" })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: "old@example.com", password: "password123" })).status).toBe(401);
  });

  it("looks identical when the new address is taken, but never sends it a code", async () => {
    await signUpAndLogin(app, "taken@example.com");
    const free = await signUpAndLogin(app, "a@example.com");
    const taker = await signUpAndLogin(app, "b@example.com");
    clearMail();

    const toFree = await request(app).post("/api/account/email").set(free.auth).send({ newEmail: "fresh@example.com", password: "password123" });
    const toTaken = await request(app).post("/api/account/email").set(taker.auth).send({ newEmail: "taken@example.com", password: "password123" });
    expect(toTaken.status).toBe(toFree.status);
    expect(toTaken.body.message.replace("taken", "X")).toBe(toFree.body.message.replace("fresh", "X"));
    expect(toTaken.body.user.pendingEmail).toBe("taken@example.com");

    expect(lastMailTo("taken@example.com")!.subject).toBe("Someone tried to use your email address");
    expect(() => lastCodeSentTo("taken@example.com")).toThrow();
    expect((await request(app).post("/api/account/email/confirm").set(taker.auth).send({ code: "123456" })).status).toBe(400);
  });

  it("can be cancelled, rejects bad codes and enforces the resend cooldown", async () => {
    const { auth } = await signUpAndLogin(app, "cancel@example.com");
    await request(app).post("/api/account/email").set(auth).send({ newEmail: "next@example.com", password: "password123" });
    const again = await request(app).post("/api/account/email").set(auth).send({ newEmail: "next@example.com", password: "password123" });
    expect(again.status).toBe(429);

    const code = lastCodeSentTo("next@example.com");
    const wrong = code === "000000" ? "111111" : "000000";
    expect((await request(app).post("/api/account/email/confirm").set(auth).send({ code: wrong })).status).toBe(400);

    const cancelled = await request(app).delete("/api/account/email/pending").set(auth);
    expect(cancelled.body.user.pendingEmail).toBeUndefined();
    expect((await request(app).post("/api/account/email/confirm").set(auth).send({ code })).status).toBe(400);
  });

  it("refuses the current address", async () => {
    const { auth } = await signUpAndLogin(app, "same@example.com");
    const res = await request(app).post("/api/account/email").set(auth).send({ newEmail: "same@example.com", password: "password123" });
    expect(res.status).toBe(400);
  });
});

describe("sign out everywhere", () => {
  it("invalidates every device's refresh token", async () => {
    const email = "everywhere@example.com";
    const { auth } = await signUpAndLogin(app, email);
    const deviceA = await loginCookie(email);
    const deviceB = await loginCookie(email);

    const res = await request(app).post("/api/account/sign-out-everywhere").set(auth);
    expect(res.status).toBe(204);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", deviceA)).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", deviceB)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: "password123" })).status).toBe(200);
  });
});

describe("delete account", () => {
  it("needs the password, then removes the user and every record, and ends all sessions", async () => {
    const email = "bye@example.com";
    const { auth, userId } = await signUpAndLogin(app, email);
    const other = await signUpAndLogin(app, "stays@example.com");
    const device = await loginCookie(email);
    const cats = (await request(app).get("/api/categories").set(auth)).body.categories as { id: string; type: string }[];
    const expense = cats.find((c) => c.type === "expense")!;
    await request(app).post("/api/transactions").set(auth).send({ category: expense.id, type: "expense", amountCents: 500, date: "2026-07-01" });
    await request(app).post("/api/budgets").set(auth).send({ category: expense.id, limitCents: 10000, month: 7, year: 2026 });
    await request(app).post("/api/loans").set(auth).send({ counterparty: "Sam", direction: "lent", principalCents: 2000, date: "2026-07-02" });
    await request(app)
      .post("/api/recurring")
      .set(auth)
      .send({ category: expense.id, type: "expense", amountCents: 900, frequency: "monthly", interval: 1, startDate: "2030-01-01" });

    expect((await request(app).delete("/api/account").set(auth).send({ password: "wrong-wrong" })).status).toBe(400);
    expect(await User.exists({ _id: userId })).toBeTruthy();

    const res = await request(app).delete("/api/account").set(auth).send({ password: "password123" });
    expect(res.status).toBe(204);

    expect(await User.exists({ _id: userId })).toBeNull();
    for (const model of [Transaction, Category, Budget, Loan, RecurringTransaction] as const) {
      expect(await (model as typeof Transaction).countDocuments({ user: userId })).toBe(0);
    }
    expect(await Category.countDocuments({ user: other.userId })).toBe(8); // other users untouched
    expect((await request(app).post("/api/auth/refresh").set("Cookie", device)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: "password123" })).status).toBe(401);
    expect(sentMail().some((m) => m.to === email && m.subject === "Your Budget App account was deleted")).toBe(true);
  });
});
