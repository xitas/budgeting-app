import "dotenv/config";
import { z } from "zod";
import { productionEnvProblems } from "./productionChecks";

// Express "trust proxy" setting, from TRUST_PROXY:
//   unset / "false"  -> false: X-Forwarded-For is ignored; req.ip is the
//                        connecting socket's address (correct when clients
//                        reach the API directly — the default).
//   "1", "2", ...    -> trust that many proxy hops in front of the API.
//   "loopback", "10.0.0.0/8, 172.16.0.0/12", ... -> trust only proxies at
//                        these addresses/subnets (Express's syntax).
// "true" (trust every hop) is refused: the client controls the leftmost
// X-Forwarded-For entry, so rate limits could be dodged with a fake header.
function parseTrustProxy(value: string | undefined, ctx: z.RefinementCtx): false | number | string {
  const v = value?.trim();
  if (!v || v.toLowerCase() === "false") return false;
  if (/^\d+$/.test(v)) return Number(v);
  if (v.toLowerCase() === "true") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'TRUST_PROXY=true would trust any X-Forwarded-For header. Use a hop count ("1") or the proxy addresses.',
    });
    return z.NEVER;
  }
  return v;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  CLIENT_ORIGIN: z.string().min(1, "CLIENT_ORIGIN is required"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  // Outgoing mail (password reset codes). With SMTP_HOST unset, mail is
  // logged to the console instead of sent — handy when Mailpit isn't running
  // (and refused in production, see productionChecks.ts).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Budget App <no-reply@budget-app.local>"),
  TRUST_PROXY: z.string().optional().transform(parseTrustProxy),
});

export type Env = z.infer<typeof envSchema>;

export class EnvConfigError extends Error {}

// Pure, so tests can check any combination of variables.
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = Object.entries(parsed.error.flatten().fieldErrors).map(([key, messages]) => `  - ${key}: ${messages?.join("; ")}`);
    throw new EnvConfigError(`Invalid environment variables:\n${lines.join("\n")}`);
  }

  if (parsed.data.NODE_ENV === "production") {
    const problems = productionEnvProblems({ ...parsed.data, MAIL_FROM: source.MAIL_FROM?.trim() || undefined });
    if (problems.length > 0) {
      throw new EnvConfigError(
        `Refusing to start in production with development settings. Fix these environment variables:\n` +
          problems.map((p) => `  - ${p}`).join("\n")
      );
    }
  }
  return parsed.data;
}

function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvConfigError) {
      // A readable message instead of a stack trace from deep in an import.
      console.error(`\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}

export const env = loadEnv();
