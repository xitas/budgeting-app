import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { parseEnv } from "../config/env";
import { LoginThrottle } from "../models/LoginThrottle";
import { delayAfterFailures, FREE_FAILURES } from "../services/loginThrottle.service";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

const tightLimits = { login: { limit: 3, windowMs: 60_000 }, signup: { limit: 2, windowMs: 60_000 } };
const login = (app: ReturnType<typeof createApp>, email: string, password: string, forwardedFor?: string) => {
  const req = request(app).post("/api/auth/login");
  if (forwardedFor) req.set("X-Forwarded-For", forwardedFor);
  return req.send({ email, password });
};

describe("per-IP rate limits on login and signup", () => {
  it("returns 429 with Retry-After once an IP uses up its login budget", async () => {
    const app = createApp({ authRateLimits: tightLimits });
    for (let i = 0; i < 3; i++) {
      expect((await login(app, `nobody${i}@example.com`, "wrong-password")).status).toBe(401);
    }
    const limited = await login(app, "someone-else@example.com", "wrong-password");
    expect(limited.status).toBe(429);
    expect(limited.body.message).toMatch(/Too many login attempts from this network/);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(limited.headers["ratelimit-policy"]).toBeDefined();
  });

  it("limits sign-ups per IP", async () => {
    const app = createApp({ authRateLimits: tightLimits });
    const signup = (n: number) => request(app).post("/api/auth/signup").send({ email: `new${n}@example.com`, password: "password123", name: "New" });
    expect((await signup(1)).status).toBe(201);
    expect((await signup(2)).status).toBe(201);
    const limited = await signup(3);
    expect(limited.status).toBe(429);
    expect(limited.body.message).toMatch(/sign-up attempts/);
  });

  it("ignores X-Forwarded-For unless trust proxy is configured", async () => {
    const app = createApp({ authRateLimits: tightLimits }); // TRUST_PROXY unset in tests
    for (let i = 0; i < 3; i++) await login(app, "x@example.com", "wrong-password", `203.0.113.${i}`);
    // A new spoofed address doesn't buy a fresh budget.
    expect((await login(app, "x@example.com", "wrong-password", "198.51.100.7")).status).toBe(429);
  });

  it("uses the forwarded client address when trust proxy is set", async () => {
    const app = createApp({ authRateLimits: tightLimits });
    app.set("trust proxy", 1); // what TRUST_PROXY=1 configures
    for (let i = 0; i < 3; i++) await login(app, `a${i}@example.com`, "wrong-password", "203.0.113.10");
    expect((await login(app, "a9@example.com", "wrong-password", "203.0.113.10")).status).toBe(429);
    // A different client behind the same proxy has its own budget.
    expect((await login(app, "b@example.com", "wrong-password", "203.0.113.11")).status).toBe(401);
  });
});

describe("per-account slowdown on failed logins", () => {
  const app = createApp(); // per-IP limits off in tests; the account throttle is always on

  async function signUp(email: string): Promise<void> {
    await request(app).post("/api/auth/signup").send({ email, password: "correct-password", name: "Throttle" });
  }

  it("gives an unknown email exactly the same responses as a wrong password", async () => {
    await signUp("real@example.com");
    const real: { status: number; body: unknown }[] = [];
    const unknown: { status: number; body: unknown }[] = [];
    for (let i = 0; i < FREE_FAILURES + 2; i++) {
      const a = await login(app, "real@example.com", "wrong-password");
      const b = await login(app, "nobody@example.com", "wrong-password");
      real.push({ status: a.status, body: { ...a.body, message: a.body.message.replace(/\d+ seconds?/, "N seconds") } });
      unknown.push({ status: b.status, body: { ...b.body, message: b.body.message.replace(/\d+ seconds?/, "N seconds") } });
    }
    expect(unknown).toEqual(real);
    expect(real.map((r) => r.status)).toEqual([401, 401, 401, 401, 429]);
    expect(real[0].body).toEqual({ message: "Invalid email or password" });
  });

  it("makes even the right password wait during the cooldown, then lets it in and resets", async () => {
    await signUp("cool@example.com");
    for (let i = 0; i < FREE_FAILURES + 1; i++) await login(app, "cool@example.com", "wrong-password");

    const blocked = await login(app, "COOL@example.com", "correct-password"); // same account, any casing
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Try again in \d+ seconds?/);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);

    // Let the cooldown pass.
    await LoginThrottle.updateOne({ key: "cool@example.com" }, { $set: { nextAllowedAt: new Date(Date.now() - 1000) } });
    expect((await login(app, "cool@example.com", "correct-password")).status).toBe(200);
    expect(await LoginThrottle.countDocuments({ key: "cool@example.com" })).toBe(0);
  });

  it("delays grow, are capped, and records expire — never a permanent lock", async () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(delayAfterFailures)).toEqual([0, 0, 0, 1000, 2000, 4000, 8000]);
    expect(delayAfterFailures(50)).toBe(15 * 60 * 1000);

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await login(app, "expiry@example.com", "wrong-password")).status);
    // Attempts rejected during a cooldown don't check the password, so they
    // don't count as failures (or grow the delay further).
    expect(statuses).toEqual([401, 401, 401, 401, 429]);
    const record = await LoginThrottle.findOne({ key: "expiry@example.com" }).lean();
    expect(record!.failures).toBe(4);
    const hoursToExpiry = (record!.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursToExpiry).toBeGreaterThan(23);
    expect(hoursToExpiry).toBeLessThanOrEqual(24);
    const indexes = await LoginThrottle.collection.indexes();
    expect(indexes.some((ix) => ix.key.expiresAt === 1 && ix.expireAfterSeconds === 0)).toBe(true);
  });
});

describe("production environment checks", () => {
  const exampleEnv = {
    NODE_ENV: "development",
    MONGO_URI: "mongodb://root:changeme@localhost:27017/budget-app?authSource=admin",
    CLIENT_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "change-this-access-secret",
    JWT_REFRESH_SECRET: "change-this-refresh-secret",
  };
  const goodProduction = {
    NODE_ENV: "production",
    MONGO_URI: "mongodb+srv://budget:Xk9%40vQ2mZp7wLr4t@cluster0.example.net/budget-app",
    CLIENT_ORIGIN: "https://budget.example.net",
    JWT_ACCESS_SECRET: "a".repeat(20) + "9f8e7d6c5b4a3f2e1d0c",
    JWT_REFRESH_SECRET: "b".repeat(20) + "0c1d2e3f4a5b6c7d8e9f",
    MAIL_FROM: "Budget App <no-reply@budget.example.net>",
    SMTP_HOST: "smtp.mailprovider.net",
  };

  it("development keeps working with the .env.example values", () => {
    expect(() => parseEnv(exampleEnv)).not.toThrow();
  });

  it("production refuses the example values and says what to set", () => {
    let message = "";
    try {
      parseEnv({ ...exampleEnv, NODE_ENV: "production" });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/^Refusing to start in production/);
    expect(message).toMatch(/JWT_ACCESS_SECRET is still the example placeholder/);
    expect(message).toMatch(/JWT_REFRESH_SECRET is still the example placeholder/);
    expect(message).toMatch(/MONGO_URI uses a default database password \("changeme"\)/);
    expect(message).toMatch(/MAIL_FROM is not set/);
    expect(message).toMatch(/SMTP_HOST is not set/);
    expect(message).toMatch(/randomBytes/); // tells you how to generate a secret
  });

  it("production accepts real-looking settings", () => {
    expect(parseEnv(goodProduction).NODE_ENV).toBe("production");
  });

  it.each([
    [{ JWT_ACCESS_SECRET: "short-but-not-placeholder" }, /JWT_ACCESS_SECRET is too short/],
    [{ JWT_REFRESH_SECRET: goodProduction.JWT_ACCESS_SECRET }, /are the same/],
    [{ MAIL_FROM: "Budget App <no-reply@budget-app.local>" }, /isn't a real sender address/],
    [{ MAIL_FROM: "noreply@example.com" }, /isn't a real sender address/],
    [{ MONGO_URI: "mongodb://admin:password@db:27017/budget" }, /default database password/],
  ])("production rejects %o", (override, expected) => {
    expect(() => parseEnv({ ...goodProduction, ...override })).toThrow(expected);
  });

  it("parses TRUST_PROXY and refuses 'true'", () => {
    expect(parseEnv(exampleEnv).TRUST_PROXY).toBe(false);
    expect(parseEnv({ ...exampleEnv, TRUST_PROXY: "1" }).TRUST_PROXY).toBe(1);
    expect(parseEnv({ ...exampleEnv, TRUST_PROXY: "loopback, 10.0.0.0/8" }).TRUST_PROXY).toBe("loopback, 10.0.0.0/8");
    expect(() => parseEnv({ ...exampleEnv, TRUST_PROXY: "true" })).toThrow(/would trust any X-Forwarded-For/);
  });
});
