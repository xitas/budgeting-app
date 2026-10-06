// Production refuses to start on development/example configuration. Each
// problem comes back as one line saying what's wrong and what to set; the
// caller reports them all at once so they can be fixed in one pass.
// Development and test are deliberately not checked — the .env.example
// values are meant to work there.

export const MIN_JWT_SECRET_LENGTH = 32;

// The placeholders shipped in server/.env.example.
const PLACEHOLDER_SECRETS = new Set(["change-this-access-secret", "change-this-refresh-secret"]);

// docker-compose.yml's default and other passwords nobody should deploy with.
const DEFAULT_DB_PASSWORDS = new Set(["changeme", "change-me", "password", "root", "admin", "mongo", "example", "secret", "123456"]);

// Domains that can't receive (or send) real mail.
const NON_DELIVERABLE_MAIL_DOMAIN = /(\.local|\.localhost|\.test|\.invalid|\.example|^example\.(com|org|net))$/i;

const GENERATE_SECRET = `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;

export interface ProductionEnvInput {
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  MONGO_URI?: string;
  MAIL_FROM?: string; // raw value: undefined when not set (the dev default doesn't count)
  SMTP_HOST?: string;
}

function checkSecret(name: string, value: string | undefined, problems: string[]): void {
  if (!value) {
    problems.push(`${name} is not set. Set it to a long random value (generate one with: ${GENERATE_SECRET}).`);
  } else if (PLACEHOLDER_SECRETS.has(value) || /change[-_ ]?this/i.test(value)) {
    problems.push(`${name} is still the example placeholder from .env.example. Replace it with a long random value (${GENERATE_SECRET}).`);
  } else if (value.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`${name} is too short (${value.length} characters; at least ${MIN_JWT_SECRET_LENGTH} required). Use a long random value (${GENERATE_SECRET}).`);
  }
}

function databasePassword(uri: string): string | null {
  // mongodb://user:password@host/... or mongodb+srv://user:password@host/...
  const match = /^mongodb(?:\+srv)?:\/\/[^:/@]*:([^@]*)@/.exec(uri);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function mailDomain(mailFrom: string): string | null {
  const address = /<([^>]+)>/.exec(mailFrom)?.[1] ?? mailFrom;
  const at = address.lastIndexOf("@");
  return at === -1 ? null : address.slice(at + 1).trim();
}

export function productionEnvProblems(input: ProductionEnvInput): string[] {
  const problems: string[] = [];

  checkSecret("JWT_ACCESS_SECRET", input.JWT_ACCESS_SECRET, problems);
  checkSecret("JWT_REFRESH_SECRET", input.JWT_REFRESH_SECRET, problems);
  if (input.JWT_ACCESS_SECRET && input.JWT_ACCESS_SECRET === input.JWT_REFRESH_SECRET) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are the same. Use two different random values.");
  }

  const password = input.MONGO_URI ? databasePassword(input.MONGO_URI) : null;
  if (password !== null && DEFAULT_DB_PASSWORDS.has(password.toLowerCase())) {
    problems.push(
      `MONGO_URI uses a default database password ("${password}"). Create a database user with a strong password and put it in MONGO_URI.`
    );
  }

  if (!input.MAIL_FROM) {
    problems.push('MAIL_FROM is not set. Set the sender for password-reset emails, e.g. MAIL_FROM="Budget App <no-reply@yourdomain.com>".');
  } else {
    const domain = mailDomain(input.MAIL_FROM);
    if (!domain || NON_DELIVERABLE_MAIL_DOMAIN.test(domain)) {
      problems.push(`MAIL_FROM ("${input.MAIL_FROM}") isn't a real sender address. Use an address on a domain you send mail from.`);
    }
  }

  // Without SMTP the mailer logs emails to the console — in production that
  // would put password-reset codes in the server logs.
  if (!input.SMTP_HOST) {
    problems.push("SMTP_HOST is not set, so password-reset emails would only be written to the server log. Set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS).");
  }

  return problems;
}
