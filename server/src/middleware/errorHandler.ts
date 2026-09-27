import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

// body-parser marks its client errors (413 payload too large, 400 malformed
// JSON) with `expose: true` and an HTTP status; pass those through instead of
// turning them into a 500.
function clientErrorStatus(err: unknown): number | undefined {
  const e = err as { status?: unknown; expose?: unknown } | null;
  return e && typeof e.status === "number" && e.status >= 400 && e.status < 500 && e.expose === true ? e.status : undefined;
}

// Must keep all four params (including unused `next`) — Express detects
// error-handling middleware by function arity (req.body.length === 4).
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof AppError ? err.statusCode : (clientErrorStatus(err) ?? 500);
  const message = err instanceof Error ? err.message : "Internal server error";

  if (statusCode === 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(statusCode).json({
    message,
    ...(env.NODE_ENV === "development" && err instanceof Error ? { stack: err.stack } : {}),
  });
}
