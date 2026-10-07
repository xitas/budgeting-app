import "express-async-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { AuthRateLimitConfig, DEFAULT_AUTH_RATE_LIMITS } from "./middleware/rateLimit";
import { accountRouter } from "./routes/account.routes";
import { createAuthRouter } from "./routes/auth.routes";
import { budgetRouter } from "./routes/budget.routes";
import { categoryRouter } from "./routes/category.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { healthRouter } from "./routes/health.routes";
import { loanRouter } from "./routes/loan.routes";
import { recurringRouter } from "./routes/recurring.routes";
import { transactionRouter } from "./routes/transaction.routes";

export interface AppOptions {
  // Per-IP limits on login/signup. Defaults to DEFAULT_AUTH_RATE_LIMITS, or
  // off under NODE_ENV=test (suites create many accounts from one address);
  // the rate-limit tests pass explicit limits.
  authRateLimits?: AuthRateLimitConfig | false;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  // Only believe X-Forwarded-For when a trusted proxy is configured (see
  // TRUST_PROXY in config/env.ts); otherwise req.ip is the socket address.
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  // Imports send up to MAX_IMPORT_ROWS rows in one request — more than the
  // default 100kb. Scoped to that path; everything else keeps the default.
  app.use("/api/transactions/import", express.json({ limit: "2mb" }));
  // Full-data backups can be large.
  app.use("/api/account/backup", express.json({ limit: "25mb" }));
  app.use(express.json());
  app.use(cookieParser());
  if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  app.use("/api/health", healthRouter);
  const authRateLimits = options.authRateLimits ?? (env.NODE_ENV === "test" ? false : DEFAULT_AUTH_RATE_LIMITS);
  app.use("/api/auth", createAuthRouter(authRateLimits));
  app.use("/api/account", accountRouter);
  app.use("/api/categories", categoryRouter);
  app.use("/api/transactions", transactionRouter);
  app.use("/api/budgets", budgetRouter);
  app.use("/api/recurring", recurringRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/loans", loanRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
