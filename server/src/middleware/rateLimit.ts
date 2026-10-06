import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";

// Per-IP limits on the credential endpoints. "IP" is req.ip, which only
// honours X-Forwarded-For when TRUST_PROXY is configured (see app.ts) —
// otherwise a client could send a fake header to get a fresh budget.
// Counters live in memory, per API process: fine for one instance; behind
// several instances, give these a shared store (e.g. Redis).
export interface LimitConfig {
  limit: number;
  windowMs: number;
}

export interface AuthRateLimitConfig {
  login: LimitConfig;
  signup: LimitConfig;
}

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimitConfig = {
  login: { limit: 20, windowMs: 15 * 60 * 1000 },
  signup: { limit: 10, windowMs: 60 * 60 * 1000 },
};

function limiter(config: LimitConfig, what: string): RequestHandler {
  return rateLimit({
    ...config,
    standardHeaders: "draft-7", // RateLimit + RateLimit-Policy, and Retry-After on 429
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      const retryAfter = Number(res.getHeader("Retry-After")) || Math.ceil(options.windowMs / 1000);
      const minutes = Math.ceil(retryAfter / 60);
      res.status(options.statusCode).json({
        message: `Too many ${what} attempts from this network. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      });
    },
  });
}

export function createAuthRateLimiters(config: AuthRateLimitConfig): { login: RequestHandler; signup: RequestHandler } {
  return { login: limiter(config.login, "login"), signup: limiter(config.signup, "sign-up") };
}
