import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

const app = createApp();
const credentials = { email: "test@example.com", password: "password123", name: "Test User" };

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe("auth flow", () => {
  it("signs up a new user, never returns the password hash, and seeds 8 default categories", async () => {
    const res = await request(app).post("/api/auth/signup").send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.accessToken).toBe("string");

    const categoriesRes = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(categoriesRes.status).toBe(200);
    expect(categoriesRes.body.categories).toHaveLength(8);
  });

  it("rejects a duplicate signup with 409", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const res = await request(app).post("/api/auth/signup").send(credentials);
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    await request(app).post("/api/auth/signup").send(credentials);

    const goodLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(goodLogin.status).toBe(200);

    const badLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "wrong-password" });
    expect(badLogin.status).toBe(401);
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("logout invalidates the existing refresh cookie", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(credentials);
    const refreshCookie = signupRes.headers["set-cookie"];

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
});
