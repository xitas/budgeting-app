# Architecture

## Overview

```
┌─────────────┐        HTTPS/JSON         ┌──────────────┐        Mongoose        ┌───────────┐
│   React SPA │  ────────────────────────▶│ Express API  │ ─────────────────────▶ │  MongoDB  │
│  (client/)  │◀──── httpOnly cookies ────│  (server/)   │◀──── aggregations ─────│           │
└─────────────┘                            └──────────────┘                        └───────────┘
```

## Auth flow (JWT access + refresh)

1. **Signup/Login** — server hashes password with bcrypt, issues a short-lived
   **access token** (returned in the JSON body, kept in memory on the client —
   never localStorage) and a long-lived **refresh token** set as an
   `httpOnly`, `secure`, `sameSite=lax` cookie (never touched by client JS).
2. **Authenticated requests** — client sends the access token; `middleware/auth.ts`
   verifies it and attaches `req.user`.
3. **Refresh** — when the access token expires, the client's axios interceptor
   calls `POST /api/auth/refresh` once; the server validates the refresh
   cookie against `User.refreshTokenVersion` and rotates both tokens.
4. **Logout** — clears the refresh cookie; bumping `refreshTokenVersion`
   invalidates all outstanding refresh tokens at once (e.g. "log out
   everywhere").
5. **Mobile clients** — a native app has no dependable cookie jar, so it sends
   `X-Client-Type: mobile` on signup/login/refresh. The server then returns
   the refresh token in the JSON body (and sets no cookie); the app keeps it in
   the device's secure storage (Keychain / Keystore) and sends it back as
   `{ refreshToken }` to `/refresh`. Browsers never send that header, so the
   web app's refresh token stays in the httpOnly cookie, out of reach of JS.
   Same rotation and `refreshTokenVersion` rules apply to both.

## Password reset (6-digit emailed code)

A code the user types in, rather than a reset link, so the same flow works
unchanged in the web app and the planned Expo mobile app — a link would need
deep-link / universal-link setup to land inside the mobile app.

1. `POST /api/auth/forgot-password` — if the email belongs to a user, stores a
   SHA-256 hash of a random 6-digit code (never the code itself) with a
   15-minute expiry and emails the code. The response is identical whether or
   not the account exists, so the endpoint can't be used to probe for
   registered emails. A request within 60s of the last code is silently
   ignored (resend throttle).
2. `POST /api/auth/reset-password` — checks the code in constant time. Each
   wrong guess increments `resetCodeAttempts`; the 5th burns the code. With
   only 10^6 possible codes, this attempt cap (not the hash) is what makes
   guessing impractical. On success it sets the new password, clears the code,
   and bumps `refreshTokenVersion` — logging out every existing session.

Mail goes through `utils/mailer.ts` (nodemailer over SMTP). Locally, SMTP
points at Mailpit from `docker-compose.yml` (inbox at http://localhost:8025);
with `SMTP_HOST` unset, messages are logged to the console instead.

## Sign-up and email verification

Sign-up never starts a session and always answers `202` with the same
message, so it can't be used to find out whether an email has an account:

- **New address** — the account is created unverified and a 6-digit code is
  emailed. `POST /auth/verify-email {email, code}` verifies it and signs in
  (the code proves the mailbox, as a password reset does).
- **Already registered** — nothing is created; the owner gets a "someone tried
  to sign up with your email" note instead (at most hourly). The same bcrypt
  work runs, so timing matches too.

Unverified users can log in with their password; both apps show a banner
with "Enter code" and "Resend code" (`POST /auth/verify-email/resend`, same
answer for every email, 60 s cooldown). A password reset also marks the email
verified. Accounts created before verification existed have no
`emailVerified` field and count as verified.

Remaining gap, by design: someone could sign up with an address and then try
logging in with the password they chose — success means the address was
free. Closing that needs "no login until verified", which the spec ruled out.

All emailed codes (reset, verification, email change) share one implementation
(`server/src/services/oneTimeCode.ts`): only a SHA-256 hash is stored, 15 min
expiry, 60 s resend cooldown, burned after 5 wrong tries.

## Account (`/api/account`, signed in)

- `PATCH /profile` — name and display currency.
- `POST /password` — needs the current password; signs out other devices and
  returns fresh tokens for this one.
- `POST /email` → `POST /email/confirm` — the code goes to the *new* address.
  If that address already has an account, its owner gets a note and no code
  is sent; the response is the same either way. `DELETE /email/pending`
  cancels.
- `POST /sign-out-everywhere` — bumps `refreshTokenVersion`, so every refresh
  token stops working (access tokens lapse within their 15-min lifetime).
- `DELETE /` `{password}` — deletes the user and all their data in one
  transaction.

Password checks here use the same per-account throttle as login.

## Display currency

Each user picks PKR (default), USD, EUR, GBP, AED, SAR or INR
(`shared/src/currency.ts`). It only changes how amounts are shown — both apps
format through `useMoney()`, which wraps the shared `formatMoney` with the
user's currency ("Rs 1,250.50", "$1,250.50"). Every listed currency has 2
decimals, so switching never changes stored values; adding one with different
decimals (JPY) would need a conversion step. CSV and backups keep plain
numbers without symbols.

## Full-data backup

`GET /api/account/backup` returns one JSON file (`shared/src/api/backup.ts`):
`format: "budget-app-backup"`, `version`, settings, categories, transactions,
budgets, recurring rules and loans with their repayments. Records keep their
ids only to link to each other.

Restoring is two calls: `POST /backup/preview` validates the file and returns
counts, date range and whether the account already has data of its own; then
`POST /backup/import {backup, replaceExisting}` replaces the account's data in
one MongoDB transaction (a bad file changes nothing). If the account has data,
`replaceExisting: true` is required — both apps ask for explicit confirmation
first. Records get new ids; links (loan ↔ transactions, recurring rule ↔
generated transactions) are carried over. The currency comes from the backup;
name and sign-in details stay the account's own.

**Versioning**: a file with a higher `version` than the app knows is refused
with "made by a newer version". When the format changes, bump `BACKUP_VERSION`
and add a step to `MIGRATIONS` in `server/src/services/backup.service.ts` that
upgrades the previous version, so older files keep importing.

## Login protection

- **Per IP** (`middleware/rateLimit.ts`): login 20 attempts / 15 min,
  sign-up 10 / hour, then 429 with `Retry-After` and the standard
  `RateLimit` headers. Counters are in memory per API process — behind
  several instances, give them a shared store (e.g. Redis).
- **Per account** (`services/loginThrottle.service.ts`): after 3 failed
  logins for an email, each further failure doubles the wait before the next
  attempt is accepted (1 s, 2 s, 4 s … capped at 15 min). Attempts during the
  wait get a 429 without checking the password — the right password too.
  Never permanent: a successful login or a password reset clears it, and the
  record expires 24 h after the last failure (MongoDB TTL index). Kept in
  MongoDB so it holds across restarts and instances.
- **No account discovery via login**: an unknown email gets exactly the
  same 401, the same throttling and — via a bcrypt comparison against a dummy
  hash — the same response time as a wrong password. (Sign-up still says an
  email is taken; hiding that needs an email-verification step, and the
  per-IP limit caps how fast it can be probed.)
- **Proxies**: `req.ip` (what the per-IP limit counts) only uses
  `X-Forwarded-For` when `TRUST_PROXY` is set — a hop count (`1` behind
  one reverse proxy / load balancer) or the proxy addresses. Left unset, the
  header is ignored, so clients can't fake a fresh address. `TRUST_PROXY=true`
  is refused.

## Production configuration

With `NODE_ENV=production` the server refuses to start (and lists every
problem with what to set) if: either JWT secret is missing, shorter than 32
characters, still the `.env.example` placeholder, or both are the same;
`MONGO_URI` uses a default password such as `changeme`; `MAIL_FROM` isn't
set explicitly or isn't on a real domain; or `SMTP_HOST` isn't set (without
it, reset emails — codes included — would only go to the log). Development
keeps working with the example values.

## Mobile app (Expo)

`mobile/` reuses the web client's API modules unchanged (same
`features/*/api.ts`, same types from `shared/`), with its own screens and
data hooks. Differences from the web client worth knowing:

- **No single-item endpoints are needed.** The web app edits rows in place;
  mobile opens edit screens, which read the item from the already-loaded list
  query (e.g. `useLoans()` then `find(id)`, or `findCachedTransaction` over the
  infinite transactions pages).
- **Wider cache invalidation.** Tab screens stay mounted instead of refetching
  on navigation, so every mutation that creates/changes/deletes a real
  `Transaction` (transactions, loans, repayments, run-now) invalidates the
  transactions list, dashboard and budgets together (`lib/queryKeys.ts`).
- **Transactions scroll instead of paging** (`useInfiniteQuery` over the same
  paginated endpoint).
- **Charts are plain React Native views** (bars and meters), not a chart
  library — no native dependency, so they run in Expo Go. They keep the web
  charts' palette slots and each ships a "View as table" twin; tapping a
  month in the trend chart plays the role the hover tooltip has on web.

## Dark mode

Both apps follow the OS setting by default, with a System / Light / Dark
override (web: nav-bar toggle, saved in `localStorage`; mobile: More →
Appearance, saved in SecureStore).

- **Web** — instead of adding `dark:` variants to every class, `index.css`
  re-steps Tailwind's color variables under `.dark` (the slate scale inverts:
  slate-50 page → darkest, slate-900 text → lightest; status tints get dark
  equivalents). Two roles that shared a color with buttons got their own
  tokens: `surface` (cards; was `bg-white`, but `text-white` still labels
  buttons) and `link` (was `text-blue-600`, but `bg-blue-600` still fills
  buttons). An inline script in `index.html` sets the class before first
  paint, so there's no white flash.
- **Mobile** — `theme.ts` holds a light and a dark color set with identical
  keys; styles are factories (`makeStyles(colors)`) memoized per scheme via
  `useThemedStyles`. The override goes through `Appearance.setColorScheme`,
  so native UI we don't style (date pickers, alerts, keyboard) follows too.
- **Charts & categories** — category colors are stored as light-palette
  hex. `schemeColor()` in `shared/` maps a stored palette color to the same
  slot's dark step (`CATEGORICAL_PALETTE_DARK`, validated against the dark
  card `#161f2e`: CVD separation and >= 3:1 contrast pass), so a category
  keeps its identity across modes; custom (non-palette) colors pass through.

## CSV export

`GET /api/transactions/export` takes the same filters as the list (minus
paging) — both go through one `buildTransactionFilter()`, so an export
always matches what the same filters show on screen. Rows are oldest first,
with the category joined in by name. `utils/csv.ts` quotes per RFC 4180,
prefixes a `'` to text cells starting with `= + - @` (so a spreadsheet can't
run a description as a formula — "CSV injection"), and adds a UTF-8 BOM so
Excel reads non-ASCII names correctly.

The endpoint needs the access token, so neither client can use a plain link:
the web fetches it as a Blob and saves it via a temporary object URL
(revoked after a delay — revoking immediately cancels the download in
Chrome); mobile writes it to the cache folder with `expo-file-system` and
opens the share sheet with `expo-sharing`.

## Dependency audit (last reviewed 2026-10-06)

`npm audit` went from 34 findings (1 critical, 22 high, 11 moderate) to 31
(20 high, 11 moderate), with nothing left in the server or web app. Fixed:
`axios` 1.18 → 1.20 (web + mobile; 12 advisories), `proxy-addr` 2.0.7 →
2.0.8 (via Express; the critical one — only exploitable with `trust proxy`
set to trust all, which the server refuses, see "Login protection"), and
`source-map-js` 1.2.1 → 1.2.2 (Vite/Tailwind build tooling). `expo`,
`expo-router` and `expo-constants` moved to the patch releases SDK 57
expects (`npx expo install --fix`).

Everything left is inside Expo's own dependency tree and waits for Expo
patch releases:

- **Metro / Expo CLI tooling** — `@expo/cli`, `@expo/metro*`, `metro*`,
  `micromatch`/`braces`, `node-forge` (also via
  `@expo/code-signing-certificates`, which `@expo/cli` pins to 0.0.6; 0.0.7
  still uses the affected node-forge 1.4.0, the latest release), and the
  `react-native`, `reanimated`/`worklets` and `datetimepicker` entries that
  are flagged only for depending on Metro's packages. These run on the
  developer machine (bundler, dev server, build signing), not in the shipped
  app.
- **`uuid` < 11.1.1 via `xcode`** (iOS config-plugin tooling, build time
  only; `xcode` only calls `uuid.v4()`).
- **`decode-uri-component` ≤ 0.4.2 via `expo-router` → `query-string@7`** —
  the one that ships in the mobile app (DoS on malformed percent-encoding in
  URL parsing). The fixed 0.5.0 is ESM-only, which `query-string@7` can't
  `require()`.

npm's suggested fixes for these are `expo@44` / `react-native@0.72` /
`expo-router@58` — major-version moves (mostly years-old downgrades) that
would break SDK 57. Don't run `npm audit fix --force` in this repo; plain
`npm audit fix` refuses too, since it would pull in the `expo@44` downgrade.

## CSV import

The file never goes to the server. The client parses it with
`shared/src/csvImport/` (pure functions, unit-tested) — the same code on the web
and on mobile, where the file comes from the system file picker — in three steps:

1. **Read** — RFC 4180 parsing with delimiter detection (`,` `;` tab), BOM
   stripped.
2. **Map** — header names are guessed into date / description / amount (or
   separate debit + credit) / optional type and category columns; the date
   format and decimal separator are detected from the data. Detection picks
   the format that parses the *most* rows, so one bad date can't mislabel a
   whole file, and it flags day/month ambiguity (all days ≤ 12) for the user
   to confirm. A live preview shows the result of every choice.
3. **Review** — `POST /api/transactions/import/check` returns rows that
   match an existing transaction (same day, type, amount to the cent and
   description, case/whitespace-insensitive); those start unticked, so
   re-importing a statement doesn't double-count. Category names from the
   file are matched to the user's categories; unmatched rows need a fallback
   category per type (no silent default) or a per-row pick.

`POST /api/transactions/import` then validates every row (ISO date,
positive amount, category owned by the user and of the same type) and
inserts them in one MongoDB transaction — all or nothing — with
`source: "import"`. Up to 5,000 rows per request; that route alone gets a
2 MB JSON limit instead of the default 100 KB.

## Money (integer cents)

Every amount is an integer count of cents — stored, sent over the API and
summed that way — so totals are exact: 0.10 + 0.20 is 30 cents, not
0.30000000000000004. The unit is in every field name: `amountCents`,
`limitCents`, `principalCents`, `repayments[].amountCents`, and the derived
`spentCents`, `remainingCents`, `repaidCents`, `outstandingCents`,
`incomeCents`, `expenseCents`, `netCents`, `netLendingCents`. 1250.50 is
`125050`. The API rejects anything else with a 400 (fractions of a cent,
strings, the old decimal `amount` field), and the Mongoose schemas refuse to
store a non-integer.

Floats only exist at the edges, and only through `shared/src/money.ts`, used
by both apps:

- **Typed input** — `parseAmountInput("12.50")` → `1250`, parsed from the
  text (never `Number(text) * 100`, which turns "0.29" into 28.999…).
- **Display** — `formatMoney(cents)` / `formatSignedAmount(cents, type)`.
- **CSV** — export writes normal decimals (`1250.50`); import parses the
  file's text straight to cents, rounding amounts with more than 2 decimals
  half up (`centsFromDecimal`).
- **Charts** — `centsToUnits()` for the plotting scale only.

The app has no currency setting; amounts are in a 2-decimal currency.

**Existing databases** stored decimals (`amount: 12.5`). `npm run
migrate:cents` (`server/src/migrations/`) converts them: it backs every
affected collection up to `<name>_backup_<stamp>`, converts each document in
one atomic update (new field set, old field removed — so a second run finds
nothing to do and never multiplies by 100 twice), and checks that each
collection's total before equals the total after. Values with more than 2
decimals stop it unless `--accept-rounding` is passed. See the README for
the steps.

## Data model decisions

- **Reference, don't embed, for `Transaction`**: transactions reference
  `User` and `Category` by ObjectId rather than embedding, because the
  collection is unbounded and grows independently of its parents — embedding
  would risk the 16MB MongoDB document size limit and duplicate category data
  across every transaction.
- **`RecurringTransaction` as a template**: a small, stable document that
  generates `Transaction` instances over time (tracked via a
  `lastGeneratedDate` cursor), rather than storing all future occurrences
  up front.
- **No denormalized "spent" field on `Budget`**: budget-vs-actual is always
  computed at read time via an aggregation pipeline over `Transaction`, so it
  is never stale relative to the source data.
- **Embed, don't reference, for `Loan.repayments`**: the deliberate contrast
  to `Transaction` above. A loan's repayments are bounded (a handful over the
  life of one loan), always read together with the loan, and never queried
  independently across users — the textbook embed case. `repaid`/`outstanding`
  are schema virtuals computed by reducing over the already-loaded
  `repayments` array — no aggregation needed, since embedding means the data
  is already in memory once the parent document loads.

## Loans and multi-document transactions

Every loan event (creating a loan, adding or removing a repayment, deleting a
loan) writes to **two** documents that must succeed or fail together: the
`Loan` itself and a linked `Transaction` (so lending/borrowing/repaying
affects real income/expense/net, not a side ledger). These writes run inside
a real MongoDB multi-document transaction (`mongoose.startSession()` /
`session.withTransaction()`), which is why local MongoDB now runs as a
**single-node replica set** (`docker-compose.yml`) instead of a plain
standalone `mongod` — standalone instances can't run `withTransaction()` at
all. `npm run mongo:up` waits (`--wait`) for the replica set to actually be
ready before returning, closing a startup race that would otherwise make the
first `withTransaction()` call fail.

Cash-flow direction is computed once, consistently, from two inputs — the
loan's `direction` and whether the event is the initial loan or a repayment:
lending out and repaying a borrowed loan are both a `Loan Out` expense;
borrowing and being repaid are both a `Loan In` income. Writing off a loan
(irrecoverable debt, or a forgiven debt from the other side) is a plain
boolean flag, not a new transaction — the original lend/borrow transaction
already recorded the real cash movement.

Because `Loan.outstanding` is a derived invariant tied to its linked
transaction's amount, editing or deleting that transaction directly (from
the Transactions table) is blocked (`409`) — it has to go through the Loans
tab, which keeps both sides in sync.

Dashboard aggregations treat loan cash flow differently depending on what
they're for: `getSummary`'s **income**/**expense** tiles and the
spending/trend charts exclude it (they're spending/earning *behavior*
figures), while a dedicated **net lending** figure and the overall **net**
include it — Income − Expense + Net lending = Net, so the arithmetic
visibly closes on the dashboard.

## Recurring transaction generation

Generation is lazy + cron-backed:
- A daily `node-cron` job calls `generateDueTransactions()` for every active
  `RecurringTransaction`.
- The same function also runs on-demand whenever a user requests their
  transactions or dashboard data, so results are never stale even if the
  server wasn't running when a transaction was due — useful in local dev.
- Generation is idempotent: it only creates transactions between
  `lastGeneratedDate` and "now", then advances the cursor.

## Dashboard aggregations

All four `/api/dashboard/*` endpoints are read-only aggregation pipelines over
`Transaction` (plus one that reuses the existing budget service) — nothing is
precomputed or denormalized:

- **Summary** (`/summary`): a single `$facet` computes four totals in one
  round trip — non-loan income, non-loan expense, loan income, and loan
  expense — from which `netLending` and the overall `net` are derived (see
  "Loans and multi-document transactions" above for why loan cash flow is
  split out).
- **Spending by category** (`/spending-by-category`): `$match` + `$group` +
  `$lookup` joins each category's name/color in the same pipeline, excluding
  loan-sourced transactions; anything past the top 7 categories folds into an
  "Other" bucket, since the categorical color palette caps at 8 usable
  identity slots.
- **Income vs expense trend** (`/income-vs-expense`): `$group` by
  `{ $year, $month, type }` over a trailing window (also excluding
  loan-sourced transactions), then zero-filled in JS so a quiet month renders
  as 0 rather than a gap. Date range boundaries are built with `Date.UTC(...)`
  rather than the local-time `Date` constructor, so they agree with
  `$year`/`$month`'s UTC-based extraction regardless of the server's local
  timezone.
- **Budget vs actual** (`/budget-vs-actual`): reuses `budget.service.ts`'s
  existing spent/remaining calculation rather than duplicating it.
