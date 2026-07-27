import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "../utils/AppError";

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });

    if (!result.success) {
      const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      throw new AppError(400, message);
    }

    // safeParse's output (result.data) is the coerced/defaulted data — e.g.
    // z.coerce.number() on a query string. Without writing it back, every
    // coercion in a schema is computed and silently thrown away, and
    // handlers keep reading the raw, un-coerced req values.
    const parsed = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }
    if (parsed.query !== undefined) {
      req.query = parsed.query as Request["query"];
    }
    if (parsed.params !== undefined) {
      req.params = parsed.params as Request["params"];
    }

    next();
  };
}
